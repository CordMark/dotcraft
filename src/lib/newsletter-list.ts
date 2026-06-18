import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";

export type NewsletterSubscriber = {
  email: string;
  source: "newsletter-form";
  subscribedAt: string;
};

type SubscribeResult = {
  created: boolean;
  subscriber: NewsletterSubscriber;
};

const defaultSubscribersFile = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "newsletter-subscribers.jsonl",
);

let writeQueue: Promise<unknown> = Promise.resolve();

function getSubscribersFile() {
  return process.env.NEWSLETTER_SUBSCRIBERS_FILE?.trim() || defaultSubscribersFile;
}

function isMissingFileError(error: unknown) {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function parseSubscriberLine(line: string): NewsletterSubscriber | null {
  try {
    const value = JSON.parse(line) as Partial<NewsletterSubscriber>;

    if (
      typeof value.email === "string" &&
      typeof value.subscribedAt === "string" &&
      value.source === "newsletter-form"
    ) {
      return {
        email: normalizeNewsletterEmail(value.email),
        source: value.source,
        subscribedAt: value.subscribedAt,
      };
    }
  } catch {
    return null;
  }

  return null;
}

function uniqueSubscribers(records: NewsletterSubscriber[]) {
  const subscribers = new Map<string, NewsletterSubscriber>();

  for (const record of records) {
    if (!subscribers.has(record.email)) {
      subscribers.set(record.email, record);
    }
  }

  return Array.from(subscribers.values()).sort((a, b) =>
    a.subscribedAt.localeCompare(b.subscribedAt),
  );
}

async function readSubscriberRecords() {
  try {
    const content = await readFile(
      /* turbopackIgnore: true */ getSubscribersFile(),
      "utf8",
    );

    return content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map(parseSubscriberLine)
      .filter((record): record is NewsletterSubscriber => record !== null);
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

async function appendSubscriber(subscriber: NewsletterSubscriber) {
  const filePath = getSubscribersFile();

  await mkdir(/* turbopackIgnore: true */ path.dirname(filePath), {
    recursive: true,
  });
  await appendFile(
    /* turbopackIgnore: true */ filePath,
    `${JSON.stringify(subscriber)}\n`,
    {
      encoding: "utf8",
      mode: 0o600,
    },
  );
}

async function subscribe(email: string): Promise<SubscribeResult> {
  const normalizedEmail = normalizeNewsletterEmail(email);
  const subscribers = uniqueSubscribers(await readSubscriberRecords());
  const existingSubscriber = subscribers.find(
    (subscriber) => subscriber.email === normalizedEmail,
  );

  if (existingSubscriber) {
    return {
      created: false,
      subscriber: existingSubscriber,
    };
  }

  const subscriber = {
    email: normalizedEmail,
    source: "newsletter-form",
    subscribedAt: new Date().toISOString(),
  } satisfies NewsletterSubscriber;

  await appendSubscriber(subscriber);

  return {
    created: true,
    subscriber,
  };
}

export function normalizeNewsletterEmail(email: string) {
  return email.trim().toLowerCase();
}

export function subscribeToNewsletterList(email: string) {
  const task = writeQueue.then(() => subscribe(email));

  writeQueue = task.catch(() => undefined);

  return task;
}

export async function getNewsletterSubscribers() {
  return uniqueSubscribers(await readSubscriberRecords());
}
