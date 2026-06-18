import nodemailer from "nodemailer";

type MailOptions = {
  from?: string;
  html: string;
  idempotencyKey?: string;
  replyTo?: string;
  subject: string;
  tags?: Array<{ name: string; value: string }>;
  text: string;
  to: string;
};

let smtpTransporter: ReturnType<typeof nodemailer.createTransport> | null =
  null;

function getRequiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getSmtpTransporter() {
  if (smtpTransporter) {
    return smtpTransporter;
  }

  const port = Number.parseInt(getRequiredEnv("SMTP_PORT"), 10);

  if (!Number.isFinite(port)) {
    throw new Error("SMTP_PORT must be a valid number");
  }

  smtpTransporter = nodemailer.createTransport({
    auth: {
      pass: getRequiredEnv("SMTP_PASS"),
      user: getRequiredEnv("SMTP_USER"),
    },
    host: getRequiredEnv("SMTP_HOST"),
    port,
    secure: process.env.SMTP_SECURE === "true",
  });

  return smtpTransporter;
}

export function getContactToEmail() {
  return getRequiredEnv("CONTACT_TO_EMAIL");
}

export function getSiteUrl() {
  return process.env.SITE_URL?.trim() || "https://dotcraft.cordmark.co.jp";
}

export function getNewsletterFromEmail() {
  return "DotCraft <dotcraft@cordmark.co.jp>";
}

function getResendApiKey() {
  const resendKey = process.env.RESEND_API_KEY?.trim();

  if (resendKey) {
    return resendKey;
  }

  const smtpPass = process.env.SMTP_PASS?.trim() || "";

  if (smtpPass.startsWith("re_") || !process.env.SMTP_HOST?.trim()) {
    return smtpPass;
  }

  return "";
}

async function sendWithResend(options: MailOptions) {
  const apiKey = getResendApiKey();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (options.idempotencyKey) {
    headers["Idempotency-Key"] = options.idempotencyKey;
  }

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify({
      from: options.from || getRequiredEnv("SMTP_FROM"),
      html: options.html,
      reply_to: options.replyTo,
      subject: options.subject,
      tags: options.tags,
      text: options.text,
      to: [options.to],
    }),
    headers,
    method: "POST",
  });
  const result = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok) {
    throw new Error(
      result?.message ||
        result?.name ||
        `Resend request failed with status ${response.status}`,
    );
  }

  return {
    id: result?.id,
    provider: "resend" as const,
  };
}

async function sendWithSmtp(options: MailOptions) {
  const transporter = getSmtpTransporter();

  const result = await transporter.sendMail({
    from: options.from || getRequiredEnv("SMTP_FROM"),
    html: options.html,
    replyTo: options.replyTo,
    subject: options.subject,
    text: options.text,
    to: options.to,
  });

  return {
    id: typeof result.messageId === "string" ? result.messageId : undefined,
    provider: "smtp" as const,
  };
}

export async function sendMail(options: MailOptions) {
  if (getResendApiKey()) {
    return await sendWithResend(options);
  }

  return await sendWithSmtp(options);
}
