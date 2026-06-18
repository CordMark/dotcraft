import { NextResponse } from "next/server";
import { getNewsletterFromEmail, sendMail } from "@/lib/mail";
import { getNewsletterSubscribers } from "@/lib/newsletter-list";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type NewsletterSendPayload = {
  dryRun?: unknown;
  html?: unknown;
  subject?: unknown;
  text?: unknown;
};

function getAdminToken() {
  return process.env.NEWSLETTER_ADMIN_TOKEN?.trim() || "";
}

function isAuthorized(request: Request) {
  const token = getAdminToken();

  if (!token) {
    return false;
  }

  return request.headers.get("authorization") === `Bearer ${token}`;
}

function field(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlFromText(text: string) {
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;background:#f5f5f3;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#fff;border:1px solid #deded9;padding:28px;font-size:15px;line-height:1.9;">
        ${escapeHtml(text).replace(/\n/g, "<br />")}
      </div>
      <p style="margin:16px 0 0;color:#777;font-size:12px;line-height:1.7;">DotCraft / CordMark</p>
    </div>
  </body>
</html>`;
}

async function sendDeliveryReport(params: {
  failed: Array<{ email: string; message: string }>;
  sent: number;
  subject: string;
  total: number;
}) {
  const reportText = [
    "Newsletter delivery result",
    `Subject: ${params.subject}`,
    `Total: ${params.total}`,
    `Sent: ${params.sent}`,
    `Failed: ${params.failed.length}`,
    params.failed.length > 0
      ? `Failures:\n${params.failed
          .map((failure) => `- ${failure.email}: ${failure.message}`)
          .join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  await sendMail({
    from: getNewsletterFromEmail(),
    html: `<pre style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;">${escapeHtml(
      reportText,
    )}</pre>`,
    subject: "【DotCraft】Newsletter配信結果",
    text: reportText,
    to: "dotcraft@cordmark.co.jp",
  });
}

async function parsePayload(request: Request) {
  try {
    return (await request.json()) as NewsletterSendPayload;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const token = getAdminToken();

  if (!token) {
    return NextResponse.json(
      { message: "Newsletter sending is not configured." },
      { status: 404 },
    );
  }

  if (!isAuthorized(request)) {
    return NextResponse.json(
      { message: "Unauthorized." },
      {
        headers: {
          "WWW-Authenticate": 'Bearer realm="newsletter-send"',
        },
        status: 401,
      },
    );
  }

  const payload = await parsePayload(request);

  if (!payload) {
    return NextResponse.json(
      { message: "送信内容を読み取れませんでした。" },
      { status: 400 },
    );
  }

  const subject = field(payload.subject);
  const text = field(payload.text);
  const html = field(payload.html);
  const dryRun = payload.dryRun === true;

  if (!subject || subject.length > 180) {
    return NextResponse.json(
      { message: "件名を180文字以内で入力してください。" },
      { status: 400 },
    );
  }

  if (!text || text.length > 20000) {
    return NextResponse.json(
      { message: "本文テキストを20000文字以内で入力してください。" },
      { status: 400 },
    );
  }

  if (html.length > 100000) {
    return NextResponse.json(
      { message: "HTML本文は100000文字以内で入力してください。" },
      { status: 400 },
    );
  }

  const subscribers = await getNewsletterSubscribers();
  const from = getNewsletterFromEmail();

  if (dryRun) {
    return NextResponse.json({
      count: subscribers.length,
      from,
      message: "dryRunのため配信していません。",
      subject,
    });
  }

  const failures: Array<{ email: string; message: string }> = [];
  let sent = 0;
  let reportError: string | null = null;

  for (const subscriber of subscribers) {
    try {
      await sendMail({
        from,
        html: html || htmlFromText(text),
        subject,
        text,
        to: subscriber.email,
      });
      sent += 1;
    } catch (error) {
      failures.push({
        email: subscriber.email,
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  try {
    await sendDeliveryReport({
      failed: failures,
      sent,
      subject,
      total: subscribers.length,
    });
  } catch (error) {
    reportError = error instanceof Error ? error.message : "Unknown error";
  }

  return NextResponse.json(
    {
      failed: failures.length,
      failures,
      from,
      message:
        failures.length > 0
          ? "一部の配信に失敗しました。"
          : "Newsletterを配信しました。",
      reportError,
      sent,
      total: subscribers.length,
    },
    {
      status: failures.length > 0 || reportError ? 207 : 200,
    },
  );
}
