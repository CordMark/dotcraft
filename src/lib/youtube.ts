import { execFile as execFileCallback } from "node:child_process";
import { mkdtemp, readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import {
  type DiarizedTranscriptSegment,
  getFfmpegPath,
  getTranscriptionLanguage,
  getTranscriptionModel,
  transcribeAudioInChunksWithOpenAI,
} from "@/lib/openai-transcription";

export type YouTubeTimestamp = {
  label: string;
  seconds: number;
  time: string;
  url: string;
};

export type YouTubeVideo = {
  description: string;
  id: string;
  publishedAt: string;
  thumbnailUrl?: string;
  timestamps: YouTubeTimestamp[];
  title: string;
  url: string;
};

type YouTubeVideoListResponse = {
  items?: Array<{
    id?: string;
    snippet?: {
      description?: string;
      publishedAt?: string;
      thumbnails?: {
        high?: { url?: string };
        medium?: { url?: string };
      };
      title?: string;
    };
  }>;
};

type YouTubePlaylistItemsResponse = {
  items?: Array<{
    snippet?: {
      resourceId?: {
        videoId?: string;
      };
    };
  }>;
};

type YouTubePlayerResponse = {
  captions?: {
    playerCaptionsTracklistRenderer?: {
      captionTracks?: Array<{
        baseUrl?: string;
        kind?: string;
        languageCode?: string;
        name?: {
          simpleText?: string;
        };
      }>;
    };
  };
  microformat?: {
    playerMicroformatRenderer?: {
      description?: {
        simpleText?: string;
      };
      publishDate?: string;
      thumbnail?: {
        thumbnails?: Array<{
          url?: string;
          width?: number;
        }>;
      };
      title?: {
        simpleText?: string;
      };
    };
  };
  streamingData?: {
    adaptiveFormats?: Array<{
      audioQuality?: string;
      bitrate?: number;
      contentLength?: string;
      mimeType?: string;
      signatureCipher?: string;
      url?: string;
    }>;
  };
  videoDetails?: {
    shortDescription?: string;
    thumbnail?: {
      thumbnails?: Array<{
        url?: string;
        width?: number;
      }>;
    };
    title?: string;
  };
};

type YouTubeCaptionJson = {
  events?: Array<{
    segs?: Array<{
      utf8?: string;
    }>;
    tStartMs?: number;
  }>;
};

const execFile = promisify(execFileCallback);
const defaultYouTubeChannelId = "UC56nbpn8CjYP6eW5UXF_sVg";
const defaultYouTubeChannelVideosUrl = "https://www.youtube.com/@dot-craft/videos";

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function youtubeApiUrl(path: string, params: Record<string, string>) {
  const url = new URL(`https://www.googleapis.com/youtube/v3/${path}`);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  url.searchParams.set("key", getRequiredEnv("YOUTUBE_API_KEY"));

  return url;
}

async function fetchJson<T>(url: URL | string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DotCraft newsletter bot",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`);
  }

  return (await response.json()) as T;
}

async function fetchText(url: URL | string) {
  const response = await fetch(url, {
    headers: {
      Accept: "text/html,application/xml,text/xml,*/*",
      "User-Agent": "Mozilla/5.0 DotCraft newsletter bot",
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}: ${url}`);
  }

  return await response.text();
}

function decodeXml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function parseVideoIdsFromFeed(xml: string, limit: number) {
  return Array.from(xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g))
    .slice(0, limit)
    .map((match) => match[1].match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1])
    .filter((id): id is string => Boolean(id));
}

async function getLatestVideoIdsFromChannelPage(limit: number) {
  const channelVideosUrl =
    process.env.YOUTUBE_CHANNEL_VIDEOS_URL?.trim() ||
    defaultYouTubeChannelVideosUrl;
  const html = await fetchText(channelVideosUrl);

  return Array.from(html.matchAll(/"videoId":"([a-zA-Z0-9_-]{11})"/g))
    .map((match) => match[1])
    .filter((id, index, ids) => ids.indexOf(id) === index)
    .slice(0, limit);
}

function hasYouTubeApiKey() {
  return Boolean(process.env.YOUTUBE_API_KEY?.trim());
}

async function getLatestVideoIds(limit: number) {
  const playlistId = process.env.YOUTUBE_PLAYLIST_ID?.trim();

  if (playlistId) {
    if (!hasYouTubeApiKey()) {
      throw new Error("YOUTUBE_API_KEY is required when YOUTUBE_PLAYLIST_ID is set.");
    }

    const data = await fetchJson<YouTubePlaylistItemsResponse>(
      youtubeApiUrl("playlistItems", {
        maxResults: String(limit),
        part: "snippet",
        playlistId,
      }),
    );

    return (
      data.items
        ?.map((item) => item.snippet?.resourceId?.videoId)
        .filter((id): id is string => Boolean(id)) || []
    );
  }

  const channelId = process.env.YOUTUBE_CHANNEL_ID?.trim() || defaultYouTubeChannelId;
  try {
    const feed = await fetchText(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(
        channelId,
      )}`,
    );
    const ids = parseVideoIdsFromFeed(feed, limit);

    if (ids.length > 0) {
      return ids;
    }
  } catch (error) {
    console.error("YouTube RSS feed failed; falling back to channel page", error);
  }

  return await getLatestVideoIdsFromChannelPage(limit);
}

function bestThumbnailUrl(
  thumbnails: Array<{ url?: string; width?: number }> | undefined,
) {
  return thumbnails
    ?.filter((thumbnail) => thumbnail.url)
    .sort((a, b) => (b.width || 0) - (a.width || 0))[0]?.url;
}

function parseYouTubePublishedAt(value: string | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function secondsFromTimestamp(value: string) {
  const parts = value
    .replace(/[()]/g, "")
    .split(":")
    .map((part) => Number.parseInt(part, 10));

  if (parts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return null;
}

function timestampUrl(videoId: string, seconds: number) {
  return `https://www.youtube.com/watch?v=${videoId}&t=${seconds}s`;
}

export function extractTimestamps(description: string, videoId: string) {
  return description
    .split(/\r?\n/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(
        /^\(?(\d{1,2}:\d{2}(?::\d{2})?)\)?\s*(?:[-–—:]\s*)?(.+)$/,
      );

      if (!match) {
        return null;
      }

      const seconds = secondsFromTimestamp(match[1]);

      if (seconds === null) {
        return null;
      }

      return {
        label: match[2].trim(),
        seconds,
        time: match[1],
        url: timestampUrl(videoId, seconds),
      } satisfies YouTubeTimestamp;
    })
    .filter((timestamp): timestamp is YouTubeTimestamp => timestamp !== null);
}

export async function getLatestYouTubeVideos(
  limit = 5,
): Promise<YouTubeVideo[]> {
  const ids = await getLatestVideoIds(limit);

  if (ids.length === 0) {
    return [];
  }

  if (!hasYouTubeApiKey()) {
    return (
      await Promise.all(ids.map((id) => fetchYouTubeVideoMetadataFromPage(id)))
    ).filter((video): video is YouTubeVideo => video !== null);
  }

  const data = await fetchJson<YouTubeVideoListResponse>(
    youtubeApiUrl("videos", {
      id: ids.join(","),
      part: "snippet",
    }),
  );
  const byId = new Map(data.items?.map((item) => [item.id, item]) || []);

  const videos = ids
    .map((id) => {
      const item = byId.get(id);
      const snippet = item?.snippet;

      if (!snippet?.title || !snippet.publishedAt) {
        return null;
      }

      const description = snippet.description || "";
      const thumbnailUrl =
        snippet.thumbnails?.high?.url || snippet.thumbnails?.medium?.url;

      return {
        description,
        id,
        publishedAt: snippet.publishedAt,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
        timestamps: extractTimestamps(description, id),
        title: decodeXml(snippet.title),
        url: `https://www.youtube.com/watch?v=${id}`,
      } satisfies YouTubeVideo;
    })
    .filter((video): video is YouTubeVideo => video !== null);

  return videos;
}

async function fetchYouTubeVideoMetadataFromPage(videoId: string) {
  const playerResponse = await fetchYouTubePlayerResponse(videoId);
  const details = playerResponse.videoDetails;
  const microformat = playerResponse.microformat?.playerMicroformatRenderer;
  const title = details?.title || microformat?.title?.simpleText;

  if (!title) {
    return null;
  }

  const description =
    details?.shortDescription || microformat?.description?.simpleText || "";
  const thumbnailUrl =
    bestThumbnailUrl(details?.thumbnail?.thumbnails) ||
    bestThumbnailUrl(microformat?.thumbnail?.thumbnails);
  const publishedAt = parseYouTubePublishedAt(microformat?.publishDate);

  return {
    description,
    id: videoId,
    publishedAt,
    ...(thumbnailUrl ? { thumbnailUrl } : {}),
    timestamps: extractTimestamps(description, videoId),
    title: decodeXml(title),
    url: `https://www.youtube.com/watch?v=${videoId}`,
  } satisfies YouTubeVideo;
}

function extractJsonObjectAfterMarker(html: string, marker: string) {
  const markerIndex = html.indexOf(marker);

  if (markerIndex < 0) {
    return null;
  }

  const start = html.indexOf("{", markerIndex);

  if (start < 0) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < html.length; index += 1) {
    const char = html[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        return html.slice(start, index + 1);
      }
    }
  }

  return null;
}

function chooseCaptionTrack(playerResponse: YouTubePlayerResponse) {
  const tracks =
    playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ||
    [];

  return (
    tracks.find(
      (track) => track.languageCode?.startsWith("ja") && track.kind !== "asr",
    ) ||
    tracks.find((track) => track.languageCode?.startsWith("ja")) ||
    tracks.find((track) => track.kind !== "asr") ||
    tracks[0]
  );
}

function chooseAudioFormat(playerResponse: YouTubePlayerResponse) {
  const formats =
    playerResponse.streamingData?.adaptiveFormats?.filter((format) =>
      format.mimeType?.startsWith("audio/"),
    ) || [];

  return formats
    .map((format) => {
      const contentLength = format.contentLength
        ? Number.parseInt(format.contentLength, 10)
        : Number.POSITIVE_INFINITY;

      return {
        ...format,
        contentLength,
      };
    })
    .filter((format) => Number.isFinite(format.contentLength))
    .sort((a, b) => a.contentLength - b.contentLength)[0];
}

function audioUrlFromFormat(format: ReturnType<typeof chooseAudioFormat>) {
  if (!format) {
    return null;
  }

  if (format.url) {
    return format.url;
  }

  if (!format.signatureCipher) {
    return null;
  }

  const params = new URLSearchParams(format.signatureCipher);
  const url = params.get("url");
  const signature = params.get("sig");

  if (!url) {
    return null;
  }

  if (!signature) {
    return null;
  }

  const signedUrl = new URL(url);
  signedUrl.searchParams.set(params.get("sp") || "signature", signature);

  return signedUrl.toString();
}

function extensionFromMimeType(mimeType: string | undefined) {
  if (mimeType?.includes("mp4")) {
    return "m4a";
  }

  if (mimeType?.includes("webm")) {
    return "webm";
  }

  return "mp3";
}

function getMaxYouTubeAudioDownloadBytes() {
  const value = Number.parseInt(process.env.YOUTUBE_AUDIO_MAX_BYTES || "", 10);

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return 150 * 1024 * 1024;
}

async function fetchYouTubePlayerResponse(videoId: string) {
  const html = await fetchText(`https://www.youtube.com/watch?v=${videoId}`);
  const json = extractJsonObjectAfterMarker(html, "ytInitialPlayerResponse");

  if (!json) {
    throw new Error("YouTube player response was not found.");
  }

  return JSON.parse(json) as YouTubePlayerResponse;
}

async function fetchYouTubeAudio(videoId: string, playerResponse: YouTubePlayerResponse) {
  try {
    return await fetchDirectYouTubeAudio(videoId, playerResponse);
  } catch (directError) {
    console.error("Direct YouTube audio download failed; trying yt-dlp", directError);
  }

  return await fetchYouTubeAudioWithYtDlp(videoId);
}

async function fetchDirectYouTubeAudio(
  videoId: string,
  playerResponse: YouTubePlayerResponse,
) {
  const maxBytes = getMaxYouTubeAudioDownloadBytes();
  const format = chooseAudioFormat(playerResponse);
  const audioUrl = audioUrlFromFormat(format);

  if (!format || !audioUrl) {
    throw new Error("No directly downloadable YouTube audio stream was found.");
  }

  if (format.contentLength && format.contentLength > maxBytes) {
    throw new Error(
      `YouTube audio stream is too large to download safely (${format.contentLength} bytes).`,
    );
  }

  const response = await fetch(audioUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 DotCraft newsletter bot",
    },
  });

  if (!response.ok) {
    throw new Error(`YouTube audio download failed with status ${response.status}.`);
  }

  const arrayBuffer = await response.arrayBuffer();

  if (arrayBuffer.byteLength > maxBytes) {
    throw new Error(
      `YouTube audio stream is too large to download safely (${arrayBuffer.byteLength} bytes).`,
    );
  }

  const mimeType = format.mimeType?.split(";")[0] || "audio/mpeg";

  return {
    blob: new Blob([arrayBuffer], { type: mimeType }),
    filename: `${videoId}.${extensionFromMimeType(format.mimeType)}`,
  };
}

function getYtDlpCommand() {
  const configured = process.env.YTDLP_PATH?.trim();

  if (configured) {
    return {
      argsPrefix: [] as string[],
      command: configured,
    };
  }

  return {
    argsPrefix: ["-m", "yt_dlp"],
    command: process.env.YTDLP_PYTHON?.trim() || "python3",
  };
}

function getYtDlpJsRuntime() {
  return process.env.YTDLP_JS_RUNTIME?.trim() || "node";
}

function getYtDlpRemoteComponents() {
  return process.env.YTDLP_REMOTE_COMPONENTS?.trim() || "ejs:github";
}

async function fetchYouTubeAudioWithYtDlp(videoId: string) {
  const maxBytes = getMaxYouTubeAudioDownloadBytes();
  const tempDir = await mkdtemp(
    path.join(/* turbopackIgnore: true */ tmpdir(), "dotcraft-youtube-audio-"),
  );
  const outputTemplate = path.join(
    /* turbopackIgnore: true */ tempDir,
    `${videoId}.%(ext)s`,
  );
  const { argsPrefix, command } = getYtDlpCommand();

  try {
    await execFile(
      command,
      [
        ...argsPrefix,
        "--quiet",
        "--no-warnings",
        "--no-playlist",
        "--js-runtimes",
        getYtDlpJsRuntime(),
        "--remote-components",
        getYtDlpRemoteComponents(),
        "--extract-audio",
        "--audio-format",
        "mp3",
        "--audio-quality",
        "0",
        "--ffmpeg-location",
        getFfmpegPath(),
        "--max-filesize",
        `${Math.floor(maxBytes / (1024 * 1024))}M`,
        "-o",
        outputTemplate,
        `https://www.youtube.com/watch?v=${videoId}`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    const files = await readdir(tempDir);
    const audioFiles = files.filter((file) => /\.(m4a|mp3|webm)$/i.test(file));

    if (audioFiles.length === 0) {
      throw new Error("yt-dlp did not create an audio file.");
    }

    const candidates = await Promise.all(
      audioFiles.map(async (file) => {
        const filePath = path.join(/* turbopackIgnore: true */ tempDir, file);
        const fileStat = await stat(filePath);

        return {
          file,
          path: filePath,
          size: fileStat.size,
        };
      }),
    );
    const audioFile = candidates.sort((a, b) => b.size - a.size)[0];

    if (audioFile.size > maxBytes) {
      throw new Error(
        `yt-dlp audio file is too large to download safely (${audioFile.size} bytes).`,
      );
    }

    const buffer = await readFile(audioFile.path);

    return {
      blob: new Blob([buffer], { type: "audio/mpeg" }),
      filename: audioFile.file,
    };
  } finally {
    await rm(tempDir, { force: true, recursive: true });
  }
}

function formatTranscriptTime(totalSeconds: number) {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(
      remainder,
    ).padStart(2, "0")}`;
  }

  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function decodeCaptionText(value: string) {
  return decodeXml(
    value.replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    ),
  ).replace(/\s+/g, " ");
}

async function fetchYouTubeCaptionTranscript(
  videoId: string,
  playerResponse: YouTubePlayerResponse,
) {
  const track = chooseCaptionTrack(playerResponse);

  if (!track?.baseUrl) {
    throw new Error("No YouTube caption track was found.");
  }

  const captionUrl = new URL(track.baseUrl);
  captionUrl.searchParams.set("fmt", "json3");

  const response = await fetch(captionUrl, {
    headers: {
      Accept: "application/json",
      "User-Agent": "DotCraft newsletter bot",
    },
  });

  if (!response.ok) {
    throw new Error(
      `YouTube caption request failed with status ${response.status}.`,
    );
  }

  const body = await response.text();

  if (!body.trim()) {
    throw new Error("YouTube caption track was empty.");
  }

  const caption = JSON.parse(body) as YouTubeCaptionJson;
  const lines =
    caption.events
      ?.map((event) => {
        const text = event.segs
          ?.map((seg) => decodeCaptionText(seg.utf8 || ""))
          .join("")
          .trim();

        if (!text) {
          return null;
        }

        return `${formatTranscriptTime((event.tStartMs || 0) / 1000)} ${text}`;
      })
      .filter((line): line is string => Boolean(line)) || [];

  if (lines.length === 0) {
    throw new Error("YouTube caption track was empty.");
  }

  return {
    languageCode: track.languageCode || "unknown",
    sourceName: track.name?.simpleText || "YouTube captions",
    text: lines.join("\n"),
  };
}

export async function fetchYouTubeTranscript(video: Pick<YouTubeVideo, "id" | "description" | "title">) {
  const playerResponse = await fetchYouTubePlayerResponse(video.id);

  try {
    return await fetchYouTubeCaptionTranscript(video.id, playerResponse);
  } catch (captionError) {
    if (!process.env.OPENAI_API_KEY?.trim()) {
      throw captionError;
    }

    console.error(
      "YouTube captions failed; falling back to OpenAI transcription",
      captionError,
    );
  }

  if (process.env.OPENAI_API_KEY?.trim()) {
    try {
      const audio = await fetchYouTubeAudio(video.id, playerResponse);
      const text = await transcribeAudioInChunksWithOpenAI({
        audio: audio.blob,
        filename: audio.filename,
        prompt: `DotCraftのYouTube動画です。タイトル: ${video.title}\n概要欄:\n${video.description.slice(
          0,
          2000,
        )}`,
      });

      return {
        languageCode: getTranscriptionLanguage(),
        segments: text.segments,
        sourceName: getTranscriptionModel(),
        text: text.text,
      } satisfies {
        languageCode: string;
        segments?: DiarizedTranscriptSegment[];
        sourceName: string;
        text: string;
      };
    } catch (error) {
      console.error("OpenAI transcription failed", error);
    }
  }

  throw new Error("No usable YouTube captions or OpenAI transcription was available.");
}
