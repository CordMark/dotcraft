import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ffmpegStatic from "ffmpeg-static";

type OpenAITranscriptionResponse = {
  error?: {
    message?: string;
  };
  segments?: Array<{
    end?: number;
    speaker?: string;
    start?: number;
    text?: string;
  }>;
  text?: string;
};

export type DiarizedTranscriptSegment = {
  end: number;
  speaker: string;
  start: number;
  text: string;
};

export type OpenAITranscriptResult = {
  segments?: DiarizedTranscriptSegment[];
  text: string;
};

type AudioChunk = {
  filename: string;
  path: string;
  size: number;
  startSeconds: number;
};

const execFile = promisify(execFileCallback);
const openAiFileUploadLimitBytes = 25 * 1024 * 1024;
const directUploadLimitBytes = 24 * 1024 * 1024;
const minimumChunkBytes = 8 * 1024;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getTranscriptionModel() {
  return (
    process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() ||
    "gpt-4o-transcribe"
  );
}

export function getTranscriptionLanguage() {
  return process.env.OPENAI_TRANSCRIPTION_LANGUAGE?.trim() || "ja";
}

function getTranscriptionChunkSeconds() {
  const value = Number.parseInt(
    process.env.OPENAI_TRANSCRIPTION_CHUNK_SECONDS || "",
    10,
  );

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return 300;
}

function getTranscriptionMaxConcurrency() {
  const value = Number.parseInt(
    process.env.OPENAI_TRANSCRIPTION_MAX_CONCURRENCY || "",
    10,
  );

  if (Number.isFinite(value) && value > 0) {
    return value;
  }

  return 6;
}

function getTranscriptionModelResponseFormat(model: string) {
  const configured = process.env.OPENAI_TRANSCRIPTION_RESPONSE_FORMAT?.trim();

  if (configured) {
    return configured;
  }

  return model.includes("diarize") ? "diarized_json" : "json";
}

function getTranscriptionChunkingStrategy(model: string) {
  if (!model.includes("diarize")) {
    return null;
  }

  return process.env.OPENAI_TRANSCRIPTION_CHUNKING_STRATEGY?.trim() || "auto";
}

function getTranscriptionChunkBitrate() {
  return process.env.OPENAI_TRANSCRIPTION_CHUNK_BITRATE?.trim() || "64k";
}

export function getFfmpegPath() {
  const configured = process.env.FFMPEG_PATH?.trim();

  if (configured) {
    return configured;
  }

  if (ffmpegStatic && existsSync(ffmpegStatic)) {
    return ffmpegStatic;
  }

  // Fall back to PATH for local machines or custom deployment images.
  return "ffmpeg";
}

function safeAudioFilename(filename: string) {
  const basename = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");

  return basename || "audio";
}

async function splitAudioIntoChunks(params: {
  audio: Blob;
  chunkSeconds?: number;
  filename: string;
}) {
  const tempDir = await mkdtemp(
    path.join(/* turbopackIgnore: true */ tmpdir(), "dotcraft-transcription-"),
  );
  const inputPath = path.join(
    /* turbopackIgnore: true */ tempDir,
    safeAudioFilename(params.filename),
  );
  const chunkPattern = path.join(
    /* turbopackIgnore: true */ tempDir,
    "chunk-%03d.mp3",
  );

  await writeFile(inputPath, Buffer.from(await params.audio.arrayBuffer()));

  try {
    await execFile(
      getFfmpegPath(),
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-y",
        "-i",
        inputPath,
        "-map",
        "0:a:0",
        "-vn",
        "-ac",
        "1",
        "-b:a",
        getTranscriptionChunkBitrate(),
        "-f",
        "segment",
        "-segment_time",
        String(params.chunkSeconds || getTranscriptionChunkSeconds()),
        "-reset_timestamps",
        "1",
        chunkPattern,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );

    const files = (await readdir(tempDir))
      .filter((file) => /^chunk-\d+\.mp3$/.test(file))
      .sort();
    const chunks = (
      await Promise.all(
        files.map(async (filename, index) => {
          const chunkPath = path.join(
            /* turbopackIgnore: true */ tempDir,
            filename,
          );
          const chunkStat = await stat(chunkPath);

          return {
            filename,
            path: chunkPath,
            size: chunkStat.size,
            startSeconds:
              index * (params.chunkSeconds || getTranscriptionChunkSeconds()),
          } satisfies AudioChunk;
        }),
      )
    ).filter((chunk) => chunk.size >= minimumChunkBytes);

    if (chunks.length === 0) {
      throw new Error("ffmpeg did not create any transcription chunks.");
    }

    const oversized = chunks.find(
      (chunk) => chunk.size >= openAiFileUploadLimitBytes,
    );

    if (oversized) {
      throw new Error(
        `Transcription chunk ${oversized.filename} is too large (${oversized.size} bytes). Reduce OPENAI_TRANSCRIPTION_CHUNK_SECONDS or OPENAI_TRANSCRIPTION_CHUNK_BITRATE.`,
      );
    }

    return {
      chunks,
      cleanup: async () => {
        await rm(tempDir, { force: true, recursive: true });
      },
    };
  } catch (error) {
    await rm(tempDir, { force: true, recursive: true });
    throw error;
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, limit), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    }),
  );

  return results;
}

export async function transcribeAudioWithOpenAI(params: {
  audio: Blob;
  filename: string;
  prompt?: string;
}): Promise<OpenAITranscriptResult> {
  if (params.audio.size >= openAiFileUploadLimitBytes) {
    throw new Error(
      `OpenAI transcription upload must be under 25 MB; got ${params.audio.size} bytes.`,
    );
  }

  const formData = new FormData();
  const model = getTranscriptionModel();

  formData.set("file", params.audio, params.filename);
  formData.set("model", model);
  formData.set("response_format", getTranscriptionModelResponseFormat(model));
  formData.set("language", getTranscriptionLanguage());

  const chunkingStrategy = getTranscriptionChunkingStrategy(model);

  if (chunkingStrategy) {
    formData.set("chunking_strategy", chunkingStrategy);
  }

  if (params.prompt && !model.includes("diarize")) {
    formData.set("prompt", params.prompt);
  }

  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    body: formData,
    headers: {
      Authorization: `Bearer ${getRequiredEnv("OPENAI_API_KEY")}`,
    },
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as
    | OpenAITranscriptionResponse
    | null;

  if (!response.ok) {
    throw new Error(
      result?.error?.message ||
        `OpenAI transcription failed with status ${response.status}`,
    );
  }

  if (!result?.text) {
    throw new Error("OpenAI transcription response did not include text.");
  }

  const segments = result.segments
    ?.map((segment) => {
      if (
        typeof segment.text !== "string" ||
        typeof segment.speaker !== "string" ||
        typeof segment.start !== "number" ||
        typeof segment.end !== "number"
      ) {
        return null;
      }

      return {
        end: segment.end,
        speaker: segment.speaker,
        start: segment.start,
        text: segment.text.trim(),
      } satisfies DiarizedTranscriptSegment;
    })
    .filter((segment): segment is DiarizedTranscriptSegment => segment !== null);

  return {
    ...(segments?.length ? { segments } : {}),
    text: result.text,
  };
}

export async function transcribeAudioInChunksWithOpenAI(params: {
  audio: Blob;
  chunkSeconds?: number;
  filename: string;
  forceChunking?: boolean;
  prompt?: string;
}): Promise<OpenAITranscriptResult> {
  if (!params.forceChunking && params.audio.size < directUploadLimitBytes) {
    return await transcribeAudioWithOpenAI(params);
  }

  const { chunks, cleanup } = await splitAudioIntoChunks(params);

  try {
    if (getTranscriptionModel().includes("diarize")) {
      console.info(
        `Transcribing ${chunks.length} audio chunks with ${getTranscriptionModel()} at concurrency ${getTranscriptionMaxConcurrency()}.`,
      );

      const results = await mapWithConcurrency(
        chunks,
        getTranscriptionMaxConcurrency(),
        async (chunk) => {
          const chunkBuffer = await readFile(chunk.path);
          const result = await transcribeAudioWithOpenAI({
            audio: new Blob([chunkBuffer], { type: "audio/mpeg" }),
            filename: chunk.filename,
          });

          return {
            ...result,
            segments: result.segments?.map((segment) => ({
              ...segment,
              end: segment.end + chunk.startSeconds,
              start: segment.start + chunk.startSeconds,
            })),
          };
        },
      );

      const segments = results.flatMap((result) => result.segments || []);

      return {
        ...(segments.length ? { segments } : {}),
        text: results
          .map((result) => result.text.trim())
          .filter(Boolean)
          .join("\n\n"),
      };
    }

    const transcripts: string[] = [];
    const segments: DiarizedTranscriptSegment[] = [];

    for (let index = 0; index < chunks.length; index += 1) {
      const chunk = chunks[index];
      const chunkBuffer = await readFile(chunk.path);
      const previousTranscript = transcripts.at(-1)?.slice(-800);
      const promptParts = [
        params.prompt,
        previousTranscript
          ? `前のchunkの末尾です。用語や文脈の継続に使ってください:\n${previousTranscript}`
          : null,
      ].filter(Boolean);
      const result = await transcribeAudioWithOpenAI({
        audio: new Blob([chunkBuffer], { type: "audio/mpeg" }),
        filename: chunk.filename,
        prompt: promptParts.join("\n\n"),
      });

      transcripts.push(result.text.trim());

      if (result.segments?.length) {
        segments.push(
          ...result.segments.map((segment) => ({
            ...segment,
            end: segment.end + chunk.startSeconds,
            start: segment.start + chunk.startSeconds,
          })),
        );
      }
    }

    return {
      ...(segments.length ? { segments } : {}),
      text: transcripts.filter(Boolean).join("\n\n"),
    };
  } finally {
    await cleanup();
  }
}
