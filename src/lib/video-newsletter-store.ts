import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type VideoNewsletterRunRecord = {
  failed?: number;
  message?: string;
  processedAt: string;
  providerIds?: string[];
  sent?: number;
  status: "failed" | "sent" | "skipped";
  title?: string;
  videoId: string;
};

const defaultRunsFile = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "video-newsletter-runs.jsonl",
);

let writeQueue: Promise<unknown> = Promise.resolve();

function getRunsFile() {
  return process.env.VIDEO_NEWSLETTER_RUNS_FILE?.trim() || defaultRunsFile;
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function parseRunLine(line: string): VideoNewsletterRunRecord | null {
  try {
    const value = JSON.parse(line) as Partial<VideoNewsletterRunRecord>;

    if (
      typeof value.videoId === "string" &&
      typeof value.processedAt === "string" &&
      (value.status === "failed" ||
        value.status === "sent" ||
        value.status === "skipped")
    ) {
      return {
        failed: value.failed,
        message: value.message,
        processedAt: value.processedAt,
        providerIds: value.providerIds,
        sent: value.sent,
        status: value.status,
        title: value.title,
        videoId: value.videoId,
      };
    }
  } catch {
    return null;
  }

  return null;
}

export async function readVideoNewsletterRuns() {
  try {
    const content = await readFile(
      /* turbopackIgnore: true */ getRunsFile(),
      "utf8",
    );

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseRunLine)
      .filter((record): record is VideoNewsletterRunRecord => record !== null);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

export async function appendVideoNewsletterRun(
  record: VideoNewsletterRunRecord,
) {
  const task = writeQueue.then(async () => {
    const filePath = getRunsFile();

    await mkdir(/* turbopackIgnore: true */ path.dirname(filePath), {
      recursive: true,
    });
    await appendFile(
      /* turbopackIgnore: true */ filePath,
      `${JSON.stringify(record)}\n`,
      {
        encoding: "utf8",
        mode: 0o600,
      },
    );
  });

  writeQueue = task.catch(() => undefined);

  await task;
}

export async function hasSentVideoNewsletter(videoId: string) {
  const runs = await readVideoNewsletterRuns();

  return runs.some(
    (record) => record.videoId === videoId && record.status === "sent",
  );
}
