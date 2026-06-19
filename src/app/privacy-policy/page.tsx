import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "../site-footer";
import { SiteHeader } from "../site-header";

const navItems = ["About", "Video", "Contents", "Newsletter", "Contact"];
const youtubeChannelUrl = "https://www.youtube.com/@dot-craft";
const contactEmail = "dotcraft@cordmark.co.jp";
const lastUpdated = "2026年6月19日";

export const metadata: Metadata = {
  title: "プライバシーポリシー | DotCraft",
  description:
    "DotCraftにおける個人情報の取得、利用目的、第三者提供、安全管理、開示等の請求、お問い合わせ窓口について定めます。",
};

const policySections = [
  {
    id: "operator",
    title: "1. 事業者情報",
    paragraphs: [
      "DotCraftは、CordMark株式会社が運営するテクノロジーメディアです。当社は、DotCraftのウェブサイト、Newsletter、お問い合わせ対応その他関連するサービスにおいて取得する個人情報を、本ポリシーに従って取り扱います。",
    ],
  },
  {
    id: "collection",
    title: "2. 取得する情報",
    paragraphs: [
      "当社は、以下の情報を取得することがあります。",
    ],
    list: [
      "お問い合わせフォームに入力された氏名、メールアドレス、カテゴリ、メッセージ内容",
      "Newsletter登録時に入力されたメールアドレス",
      "フォーム送信日時、配信履歴、問い合わせ対応に必要な連絡履歴",
      "サイトの利用状況、アクセス日時、ブラウザ情報、端末情報、Cookie等の識別子",
      "YouTube、X、Discord等の外部サービスへ遷移した場合に、各サービス側で取得される情報",
    ],
  },
  {
    id: "purpose",
    title: "3. 利用目的",
    paragraphs: [
      "取得した個人情報は、以下の目的の範囲で利用します。",
    ],
    list: [
      "お問い合わせへの回答、本人確認、連絡、記録管理のため",
      "Newsletter、動画更新情報、イベント情報、関連コンテンツを配信するため",
      "配信停止、登録状況確認、不正登録防止などNewsletter運営に必要な対応のため",
      "サイト、コンテンツ、フォーム、メール配信の品質改善および利用状況分析のため",
      "不正アクセス、迷惑行為、権利侵害その他トラブルの防止および対応のため",
      "法令または公的機関からの要請に対応するため",
    ],
  },
  {
    id: "third-party",
    title: "4. 第三者提供および委託",
    paragraphs: [
      "当社は、本人の同意がある場合、法令に基づく場合、生命・身体・財産の保護のために必要な場合その他法令で認められる場合を除き、個人データを第三者へ提供しません。",
      "当社は、メール配信、ホスティング、問い合わせ管理、アクセス解析、セキュリティ対策など、利用目的の達成に必要な範囲で業務の一部を外部事業者へ委託することがあります。この場合、委託先に対して必要かつ適切な管理を行います。",
    ],
  },
  {
    id: "external-services",
    title: "5. 外部サービス",
    paragraphs: [
      "DotCraftでは、YouTube、X、Discordなどの外部サービスへのリンクや埋め込みを利用することがあります。外部サービス上で取得される情報は、各サービス提供者のプライバシーポリシーおよび規約に従って取り扱われます。",
      "Newsletter配信や運用通知では、メール配信サービス、クラウドサービスその他の外部サービスを利用する場合があります。",
    ],
  },
  {
    id: "cookies",
    title: "6. Cookie等の利用",
    paragraphs: [
      "当社は、サイトの動作維持、セキュリティ確保、利用状況の把握、コンテンツ改善のためにCookieまたは類似技術を利用することがあります。Cookieの利用を希望しない場合、利用者はブラウザ設定によりCookieを無効化できます。ただし、一部機能が正常に利用できない場合があります。",
    ],
  },
  {
    id: "security",
    title: "7. 安全管理措置",
    paragraphs: [
      "当社は、個人情報の漏えい、滅失、毀損、不正アクセスを防止するため、アクセス権限の管理、通信および保存環境の保護、委託先管理、社内での取扱いルール整備など、必要かつ適切な安全管理措置を講じます。",
    ],
  },
  {
    id: "rights",
    title: "8. 開示、訂正、利用停止等の請求",
    paragraphs: [
      "本人から、当社が保有する個人データについて、開示、訂正、追加、削除、利用停止、消去、第三者提供の停止その他法令に基づく請求があった場合、本人確認を行ったうえで、法令に従い適切に対応します。",
    ],
  },
  {
    id: "changes",
    title: "9. 改定",
    paragraphs: [
      "当社は、法令の変更、サービス内容の変更、運用上の必要に応じて、本ポリシーを改定することがあります。重要な変更がある場合は、本サイト上で告知します。",
    ],
  },
  {
    id: "contact",
    title: "10. お問い合わせ窓口",
    paragraphs: [
      "本ポリシーおよび個人情報の取扱いに関するお問い合わせは、以下の窓口までご連絡ください。",
    ],
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="site-shell policy-shell">
      <SiteHeader
        homeHref="/"
        navBaseHref="/"
        navItems={navItems}
        youtubeUrl={youtubeChannelUrl}
      />

      <section className="policy-hero">
        <div className="policy-hero-inner">
          <Link className="policy-back-link" href="/">
            <ArrowLeft size={18} />
            トップへ戻る
          </Link>
          <p className="section-kicker">Privacy Policy</p>
          <h1>プライバシーポリシー</h1>
          <p>
            DotCraftは、利用者の個人情報を適切に保護し、透明性のある取扱いを行うため、以下の方針を定めます。
          </p>
          <dl className="policy-meta">
            <div>
              <dt>運営者</dt>
              <dd>CordMark株式会社</dd>
            </div>
            <div>
              <dt>最終更新日</dt>
              <dd>{lastUpdated}</dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="policy-section" aria-label="プライバシーポリシー本文">
        <div className="policy-layout">
          <aside className="policy-toc" aria-label="目次">
            <p>Policy</p>
            <nav>
              {policySections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>
                  {section.title.replace(/^\d+\.\s*/, "")}
                </a>
              ))}
            </nav>
          </aside>

          <div className="policy-content">
            {policySections.map((section) => (
              <article className="policy-card" id={section.id} key={section.id}>
                <h2>{section.title}</h2>
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.list ? (
                  <ul className="policy-list">
                    {section.list.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                ) : null}
                {section.id === "contact" ? (
                  <div className="policy-contact">
                    <span>DotCraft / CordMark株式会社</span>
                    <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      </section>

      <SiteFooter
        currentPage="privacy"
        homeHref="/"
        navBaseHref="/"
        navItems={navItems}
        youtubeUrl={youtubeChannelUrl}
      />
    </main>
  );
}
