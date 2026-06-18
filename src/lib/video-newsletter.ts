import { createHash } from "node:crypto";
import { createDeepSeekJson } from "@/lib/deepseek";
import type { DiarizedTranscriptSegment } from "@/lib/openai-transcription";
import { getNewsletterFromEmail, sendMail } from "@/lib/mail";
import {
  appendVideoNewsletterRun,
  hasSentVideoNewsletter,
} from "@/lib/video-newsletter-store";
import {
  fetchYouTubeTranscript,
  getLatestYouTubeVideos,
  type YouTubeTimestamp,
  type YouTubeVideo,
} from "@/lib/youtube";
import { getNewsletterSubscribers } from "@/lib/newsletter-list";

type TranscriptResult = {
  formattingNotes?: string;
  languageCode: string;
  segments?: DiarizedTranscriptSegment[];
  sourceName: string;
  text: string;
};

type GeneratedVideoNewsletter = {
  closing: string;
  hook: string;
  intro: string;
  keyPoints: string[];
  preview: string;
  subject: string;
};

type FormattedTranscript = {
  notes?: string;
  speakers?: Array<{
    description?: string;
    label: string;
    speaker: string;
  }>;
  text: string;
};

type DeliveryResult = {
  failed: Array<{ email: string; message: string }>;
  providerIds: string[];
  sent: number;
  total: number;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraphs(value: string) {
  return value
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

function textFromList(items: string[]) {
  return items.map((item) => `- ${item}`).join("\n");
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

function segmentLines(segments: DiarizedTranscriptSegment[] | undefined) {
  if (!segments?.length) {
    return "";
  }

  return segments
    .map(
      (segment) =>
        `[${formatTranscriptTime(segment.start)}-${formatTranscriptTime(
          segment.end,
        )}] Speaker ${segment.speaker}: ${segment.text}`,
    )
    .join("\n");
}

function emailHash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

function timestampListHtml(timestamps: YouTubeTimestamp[]) {
  if (timestamps.length === 0) {
    return "<p>概要欄からtimestampを検出できませんでした。</p>";
  }

  return `<ol>${timestamps
    .map(
      (timestamp) =>
        `<li><a href="${escapeHtml(timestamp.url)}">${escapeHtml(
          timestamp.time,
        )}</a> ${escapeHtml(timestamp.label)}</li>`,
    )
    .join("")}</ol>`;
}

function timestampListText(timestamps: YouTubeTimestamp[]) {
  if (timestamps.length === 0) {
    return "概要欄からtimestampを検出できませんでした。";
  }

  return timestamps
    .map((timestamp) => `${timestamp.time} ${timestamp.label} ${timestamp.url}`)
    .join("\n");
}

async function generateNewsletter(
  video: YouTubeVideo,
  transcript: TranscriptResult,
) {
  return await createDeepSeekJson<GeneratedVideoNewsletter>([
      {
        content:
          "あなたはDotCraftの日本語newsletter編集者です。出力は有効なJSONだけにしてください。スポンサー欄は作らないでください。誇張せず、動画内容に忠実に、知的だが読みやすい日本語で書いてください。",
      role: "system",
    },
    {
      content: JSON.stringify({
        instruction:
          "YouTube動画の概要欄と、読みやすく整形された文字起こしからnewsletterを作成してください。subjectは日本語で短く、previewはメールのプレビューテキスト、hookは1文の惹き、introは2-4段落、keyPointsは4-7個、closingは短い締めにしてください。",
        outputShape: {
          closing: "string",
          hook: "string",
          intro: "string",
          keyPoints: ["string"],
          preview: "string",
          subject: "string",
        },
        transcript: transcript.text,
        transcriptSource: transcript.sourceName,
        video: {
          description: video.description,
          publishedAt: video.publishedAt,
          timestamps: video.timestamps,
          title: video.title,
          url: video.url,
        },
      }),
      role: "user",
    },
  ]);
}

async function formatTranscriptForNewsletter(
  video: YouTubeVideo,
  transcript: TranscriptResult,
): Promise<TranscriptResult> {
  const diarizedLines = segmentLines(transcript.segments);

  try {
    const formatted = await createDeepSeekJson<FormattedTranscript>([
      {
        content:
          "あなたは日本語podcast/newsletter用の文字起こし校正者です。出力は有効なJSONだけにしてください。原文の口調、言い回し、語尾、温度感、くだけ具合を維持し、読みやすさだけを整えてください。",
        role: "system",
      },
      {
        content: JSON.stringify({
          instruction:
            "transcriptを読者向けに整形してください。目的は、長い文字の塊を読みやすくすることだけです。句読点、改行、段落分け、明らかな文字起こし誤りの修正だけを行ってください。言い回し、語順、語尾、口癖、くだけた表現、温度感、話している人の癖はできるだけそのまま残してください。要約、意訳、上品な言い換え、ビジネス文体への変換、論旨の補強、新しい説明の追加は禁止です。フィラーや言い淀みも原則残し、読みづらさに直結する明らかな重複やノイズだけ最小限削ってください。話者segmentがない場合は、話者名やSpeaker A/Bなどの話者ラベルを新しく付けないでください。話者segmentがある場合だけspeakerを維持してください。見出しは付けず、本文は transcript text だけにしてください。",
          outputShape: {
            notes: "string",
            speakers: [
              {
                description: "string",
                label: "string",
                speaker: "string",
              },
            ],
            text: "string",
          },
          hasSpeakerSegments: diarizedLines.length > 0,
          rawTranscript: transcript.text.slice(0, 70000),
          speakerSegments: diarizedLines.slice(0, 70000),
          transcriptSource: transcript.sourceName,
          video: {
            description: video.description,
            timestamps: video.timestamps,
            title: video.title,
            url: video.url,
          },
        }),
        role: "user",
      },
    ]);

    if (!formatted.text?.trim()) {
      return transcript;
    }

    const speakerNotes = transcript.segments?.length && formatted.speakers?.length
      ? `Speakers: ${formatted.speakers
          .map((speaker) =>
            `${speaker.speaker}=${speaker.label}${
              speaker.description ? ` (${speaker.description})` : ""
            }`,
          )
          .join(", ")}`
      : "";
    const notes = [speakerNotes, formatted.notes].filter(Boolean).join("\n");

    return {
      ...transcript,
      ...(notes ? { formattingNotes: notes } : {}),
      sourceName: `${transcript.sourceName} + DeepSeek transcript formatting`,
      text: formatted.text.trim(),
    };
  } catch (error) {
    console.error("Transcript formatting failed; using raw transcript", error);
    return transcript;
  }
}

function normalizeGeneratedNewsletter(
  generated: GeneratedVideoNewsletter,
  video: YouTubeVideo,
) {
  return {
    closing: generated.closing || "それでは、動画でお楽しみください。",
    hook: generated.hook || video.title,
    intro: generated.intro || video.description,
    keyPoints: Array.isArray(generated.keyPoints)
      ? generated.keyPoints.filter((item) => typeof item === "string")
      : [],
    preview: generated.preview || generated.hook || video.title,
    subject: generated.subject || `【DotCraft】${video.title}`,
  };
}

function buildNewsletterHtml(
  video: YouTubeVideo,
  transcript: TranscriptResult,
  generated: GeneratedVideoNewsletter,
) {
  const content = normalizeGeneratedNewsletter(generated, video);

  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;background:#f5f5f3;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;">${escapeHtml(
      content.preview,
    )}</div>
    <main style="max-width:680px;margin:0 auto;padding:32px 20px;">
      <p style="margin:0 0 20px;font-size:13px;color:#777;">DotCraft Newsletter</p>
      <p style="margin:0 0 16px;"><a href="${escapeHtml(
        video.url,
      )}" style="color:#111;font-weight:700;">Watch now</a></p>
      <h1 style="margin:0 0 10px;font-size:30px;line-height:1.25;">${escapeHtml(
        video.title,
      )}</h1>
      <p style="margin:0 0 28px;font-size:18px;line-height:1.7;color:#333;">${escapeHtml(
        content.hook,
      )}</p>
      ${
        video.thumbnailUrl
          ? `<p><a href="${escapeHtml(video.url)}"><img src="${escapeHtml(
              video.thumbnailUrl,
            )}" alt="" style="display:block;width:100%;height:auto;border:0;" /></a></p>`
          : ""
      }
      <section style="font-size:16px;line-height:1.9;margin-top:28px;">
        ${htmlParagraphs(content.intro)}
      </section>
      <section style="margin-top:32px;">
        <h2 style="font-size:18px;margin:0 0 12px;">今回の見どころ</h2>
        <ul style="font-size:15px;line-height:1.8;padding-left:22px;">
          ${content.keyPoints
            .map((point) => `<li>${escapeHtml(point)}</li>`)
            .join("")}
        </ul>
      </section>
      <section style="margin-top:32px;">
        <h2 style="font-size:18px;margin:0 0 12px;">Timestamps</h2>
        <div style="font-size:15px;line-height:1.8;">${timestampListHtml(
          video.timestamps,
        )}</div>
      </section>
      <section style="margin-top:32px;">
        <h2 style="font-size:18px;margin:0 0 12px;">Readable Transcript</h2>
        <p style="font-size:12px;line-height:1.7;color:#777;">AIによる文字起こしと整形</p>
        ${
          transcript.formattingNotes
            ? `<p style="font-size:12px;line-height:1.7;color:#777;">${escapeHtml(
                transcript.formattingNotes,
              ).replace(/\n/g, "<br />")}</p>`
            : ""
        }
        <pre style="white-space:pre-wrap;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.7;background:#fff;border:1px solid #deded9;padding:16px;overflow:auto;">${escapeHtml(
          transcript.text,
        )}</pre>
      </section>
      <section style="margin-top:28px;font-size:15px;line-height:1.8;">
        ${htmlParagraphs(content.closing)}
      </section>
      <p style="margin:32px 0 0;color:#777;font-size:12px;line-height:1.7;">DotCraft / CordMark</p>
    </main>
  </body>
</html>`;
}

function buildNewsletterText(
  video: YouTubeVideo,
  transcript: TranscriptResult,
  generated: GeneratedVideoNewsletter,
) {
  const content = normalizeGeneratedNewsletter(generated, video);

  return `${video.title}
${content.hook}

Watch now: ${video.url}

${content.intro}

今回の見どころ
${textFromList(content.keyPoints)}

Timestamps
${timestampListText(video.timestamps)}

Readable Transcript
AIによる文字起こしと整形
${transcript.formattingNotes ? `\n${transcript.formattingNotes}\n` : ""}

${transcript.text}

${content.closing}
`;
}

async function deliverNewsletter(
  video: YouTubeVideo,
  subject: string,
  html: string,
  text: string,
  dryRun: boolean,
  resendKey?: string,
): Promise<DeliveryResult> {
  const subscribers = await getNewsletterSubscribers();
  const result: DeliveryResult = {
    failed: [],
    providerIds: [],
    sent: 0,
    total: subscribers.length,
  };

  if (dryRun) {
    return result;
  }

  for (const subscriber of subscribers) {
    try {
      const sendResult = await sendMail({
        from: getNewsletterFromEmail(),
        html,
        idempotencyKey: [
          "video-newsletter",
          video.id,
          emailHash(subscriber.email),
          resendKey,
        ]
          .filter(Boolean)
          .join("-"),
        subject,
        tags: [
          { name: "kind", value: "video_newsletter" },
          { name: "video_id", value: video.id },
        ],
        text,
        to: subscriber.email,
      });

      if (sendResult.id) {
        result.providerIds.push(sendResult.id);
      }

      result.sent += 1;
    } catch (error) {
      result.failed.push({
        email: subscriber.email,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}

async function sendResultReport(params: {
  delivery?: DeliveryResult;
  dryRun: boolean;
  error?: string;
  subject?: string;
  video?: YouTubeVideo;
}) {
  const videoTitle = params.video?.title || "unknown video";
  const status = params.error
    ? "failed"
    : params.dryRun
      ? "dry-run"
      : "completed";
  const subject = `【DotCraft】動画Newsletter配信結果: ${status}`;
  const text = [
    `Status: ${status}`,
    `Video: ${videoTitle}`,
    params.video ? `URL: ${params.video.url}` : "",
    params.subject ? `Newsletter subject: ${params.subject}` : "",
    params.delivery
      ? `Recipients: ${params.delivery.total}, sent: ${params.delivery.sent}, failed: ${params.delivery.failed.length}`
      : "",
    params.error ? `Error: ${params.error}` : "",
    params.delivery?.failed.length
      ? `Failures:\n${params.delivery.failed
          .map((failure) => `- ${failure.email}: ${failure.message}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    from: getNewsletterFromEmail(),
    html: `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;">${escapeHtml(
      text,
    )}</pre>`,
    subject,
    text,
    to: "dotcraft@cordmark.co.jp",
  });
}

export async function runVideoNewsletterJob(options?: {
  dryRun?: boolean;
  force?: boolean;
  resendKey?: string;
}) {
  const dryRun = options?.dryRun === true;
  const force = options?.force === true;
  const resendKey = force
    ? options?.resendKey || `manual-${Date.now()}`
    : undefined;
  const videos = await getLatestYouTubeVideos(5);

  for (const video of videos) {
    if (!force && (await hasSentVideoNewsletter(video.id))) {
      continue;
    }

    try {
      const transcript = await formatTranscriptForNewsletter(
        video,
        await fetchYouTubeTranscript(video),
      );
      const generated = normalizeGeneratedNewsletter(
        await generateNewsletter(video, transcript),
        video,
      );
      const html = buildNewsletterHtml(video, transcript, generated);
      const text = buildNewsletterText(video, transcript, generated);
      const delivery = await deliverNewsletter(
        video,
        generated.subject,
        html,
        text,
        dryRun,
        resendKey,
      );

      if (!dryRun) {
        await appendVideoNewsletterRun({
          failed: delivery.failed.length,
          processedAt: new Date().toISOString(),
          providerIds: delivery.providerIds,
          sent: delivery.sent,
          status: delivery.sent > 0 || delivery.total === 0 ? "sent" : "failed",
          title: video.title,
          videoId: video.id,
        });
      }

      await sendResultReport({
        delivery,
        dryRun,
        subject: generated.subject,
        video,
      });

      return {
        delivery,
        dryRun,
        status: dryRun ? "dry_run" : "processed",
        subject: generated.subject,
        video,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (!dryRun) {
        await appendVideoNewsletterRun({
          message,
          processedAt: new Date().toISOString(),
          status: "failed",
          title: video.title,
          videoId: video.id,
        });
      }

      await sendResultReport({
        dryRun,
        error: message,
        video,
      });

      throw error;
    }
  }

  return {
    dryRun,
    status: "no_new_video",
    totalChecked: videos.length,
  };
}
