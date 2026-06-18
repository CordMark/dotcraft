import { NextResponse } from "next/server";
import {
  getContactToEmail,
  getNewsletterFromEmail,
  getSiteUrl,
  sendMail,
} from "@/lib/mail";
import { subscribeToNewsletterList } from "@/lib/newsletter-list";

export const runtime = "nodejs";

const categories = new Set([
  "コラボレーション",
  "取材・メディア掲載",
  "講演・登壇",
  "その他",
]);

function field(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlParagraph(value: string) {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function emailLayout(title: string, body: string) {
  return `<!doctype html>
<html lang="ja">
  <body style="margin:0;background:#f5f5f3;color:#111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <div style="max-width:640px;margin:0 auto;padding:32px 20px;">
      <div style="background:#fff;border:1px solid #deded9;padding:28px;">
        <h1 style="margin:0 0 20px;font-size:22px;line-height:1.5;">${escapeHtml(title)}</h1>
        <div style="font-size:15px;line-height:1.9;">${body}</div>
      </div>
      <p style="margin:16px 0 0;color:#777;font-size:12px;line-height:1.7;">DotCraft / CordMark</p>
    </div>
  </body>
</html>`;
}

function submittedAt() {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(new Date());
}

async function handleNewsletter(payload: Record<string, unknown>) {
  const email = field(payload.email);

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { message: "メールアドレスを正しく入力してください。" },
      { status: 400 },
    );
  }

  const time = submittedAt();
  const subscription = await subscribeToNewsletterList(email);
  let confirmationEmailSent = false;

  if (subscription.created) {
    try {
      const contactTo = getContactToEmail();
      const siteUrl = getSiteUrl();

      await Promise.all([
        sendMail({
          from: getNewsletterFromEmail(),
          html: emailLayout(
            "Newsletter登録",
            `<p>Newsletterフォームから登録がありました。</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;width:150px;">メールアドレス</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(subscription.subscriber.email)}</td></tr>
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;">送信日時</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(time)}</td></tr>
        </table>`,
          ),
          replyTo: subscription.subscriber.email,
          subject: "【DotCraft】Newsletter登録",
          text: `Newsletterフォームから登録がありました。\n\nメールアドレス: ${subscription.subscriber.email}\n送信日時: ${time}`,
          to: contactTo,
        }),
        sendMail({
          from: getNewsletterFromEmail(),
          html: emailLayout(
            "Newsletter登録ありがとうございます",
            `<p>DotCraft Newsletterへのご登録を受け付けました。</p>
        <p>今後、限定コラムや最新情報をお届けします。</p>
        <p><a href="${escapeHtml(siteUrl)}" style="color:#111;">${escapeHtml(siteUrl)}</a></p>`,
          ),
          subject: "【DotCraft】Newsletter登録ありがとうございます",
          text: `DotCraft Newsletterへのご登録を受け付けました。\n\n${siteUrl}`,
          to: subscription.subscriber.email,
        }),
      ]);

      confirmationEmailSent = true;
    } catch (error) {
      console.error("Failed to send newsletter email", error);
    }
  }

  return NextResponse.json({
    message: subscription.created
      ? confirmationEmailSent
        ? "登録を受け付けました。確認メールをお送りしました。"
        : "登録を受け付けました。"
      : "登録済みのメールアドレスです。配信リストに登録されています。",
  });
}

async function handleContact(payload: Record<string, unknown>) {
  const name = field(payload.name);
  const email = field(payload.email);
  const category = field(payload.category);
  const message = field(payload.message);

  if (!name || name.length > 120) {
    return NextResponse.json(
      { message: "お名前を入力してください。" },
      { status: 400 },
    );
  }

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { message: "メールアドレスを正しく入力してください。" },
      { status: 400 },
    );
  }

  if (!categories.has(category)) {
    return NextResponse.json(
      { message: "カテゴリを選択してください。" },
      { status: 400 },
    );
  }

  if (!message || message.length > 5000) {
    return NextResponse.json(
      { message: "メッセージを入力してください。" },
      { status: 400 },
    );
  }

  const contactTo = getContactToEmail();
  const siteUrl = getSiteUrl();
  const time = submittedAt();

  await Promise.all([
    sendMail({
      html: emailLayout(
        "お問い合わせ",
        `<p>DotCraftのお問い合わせフォームから送信がありました。</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;width:150px;">お名前</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(name)}</td></tr>
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;">メールアドレス</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(email)}</td></tr>
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;">カテゴリ</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(category)}</td></tr>
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;">送信日時</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(time)}</td></tr>
        </table>
        <h2 style="margin:24px 0 8px;font-size:16px;">メッセージ</h2>
        <p>${htmlParagraph(message)}</p>`,
      ),
      replyTo: email,
      subject: `【DotCraft】お問い合わせ: ${category}`,
      text: `DotCraftのお問い合わせフォームから送信がありました。\n\nお名前: ${name}\nメールアドレス: ${email}\nカテゴリ: ${category}\n送信日時: ${time}\n\nメッセージ:\n${message}`,
      to: contactTo,
    }),
    sendMail({
      html: emailLayout(
        "お問い合わせを受け付けました",
        `<p>${escapeHtml(name)} 様</p>
        <p>DotCraftへお問い合わせいただきありがとうございます。以下の内容で受け付けました。</p>
        <table style="width:100%;border-collapse:collapse;margin-top:16px;">
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;width:150px;">カテゴリ</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(category)}</td></tr>
          <tr><th align="left" style="border-top:1px solid #ddd;padding:10px 0;">送信日時</th><td style="border-top:1px solid #ddd;padding:10px 0;">${escapeHtml(time)}</td></tr>
        </table>
        <h2 style="margin:24px 0 8px;font-size:16px;">メッセージ</h2>
        <p>${htmlParagraph(message)}</p>
        <p style="margin-top:24px;">内容を確認のうえ、担当者よりご連絡いたします。</p>
        <p><a href="${escapeHtml(siteUrl)}" style="color:#111;">${escapeHtml(siteUrl)}</a></p>`,
      ),
      replyTo: contactTo,
      subject: "【DotCraft】お問い合わせを受け付けました",
      text: `${name} 様\n\nDotCraftへお問い合わせいただきありがとうございます。以下の内容で受け付けました。\n\nカテゴリ: ${category}\n送信日時: ${time}\n\nメッセージ:\n${message}\n\n内容を確認のうえ、担当者よりご連絡いたします。\n${siteUrl}`,
      to: email,
    }),
  ]);

  return NextResponse.json({
    message: "送信しました。確認メールをお送りしました。",
  });
}

export async function POST(request: Request) {
  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { message: "送信内容を読み取れませんでした。" },
      { status: 400 },
    );
  }

  if (field(payload.company)) {
    return NextResponse.json({ message: "送信しました。" });
  }

  try {
    if (field(payload.formType) === "newsletter") {
      return await handleNewsletter(payload);
    }

    return await handleContact(payload);
  } catch (error) {
    console.error("Failed to send contact email", error);

    return NextResponse.json(
      { message: "送信に失敗しました。時間をおいて再度お試しください。" },
      { status: 500 },
    );
  }
}
