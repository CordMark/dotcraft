import Image from "next/image";
import {
  ArrowRight,
  Calendar,
  CirclePlay,
  ExternalLink,
  Mail,
  Play,
  SquarePlay,
} from "lucide-react";
import { ContactForm, NewsletterForm } from "./contact-forms";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

const youtubeChannelUrl = "https://www.youtube.com/@dot-craft";
const youtubeChannelId = "UC56nbpn8CjYP6eW5UXF_sVg";
const latestVideoFallback = {
  description:
    "コンテキストエンジニアリングの次に来る開発思想「ループエンジニアリング」をテーマに、AI時代のソフトウェア開発と人間の役割の変化を掘り下げます。",
  publishedAt: "2026-06-12T09:00:35+00:00",
  title:
    "【Loop Engineering】ループエンジニアリングとは何か？ソフトウェア開発の完全自動化は近い",
  url: "https://www.youtube.com/watch?v=NHMdaxnfkWs",
  videoId: "NHMdaxnfkWs",
};

const navItems = ["About", "Video", "Contents", "Newsletter", "Contact"];

const aboutHosts = [
  {
    name: "橋本 武士",
    image: "/assets/about-host-takeshi.png",
    alt: "橋本 武士のプロフィール写真",
    xHandle: "@dancing_amigo",
    xUrl: "https://x.com/dancing_amigo",
  },
  {
    name: "山本 圭亮",
    image: "/assets/about-host-keisuke.png",
    alt: "山本 圭亮のプロフィール写真",
    xHandle: "@_AlwaysAI",
    xUrl: "https://x.com/_AlwaysAI",
  },
];

const contentLinks = [
  {
    title: "YouTube",
    body: "最新動画や人気動画をチェックできます。",
    icon: "youtube",
    href: youtubeChannelUrl,
    external: true,
  },
  {
    title: "X（旧Twitter）",
    body: "最新情報や日々の気づきをタイムリーに発信中。",
    icon: "x",
    href: "https://x.com/dot_craft_",
    external: true,
  },
  {
    title: "Discord Community",
    body: "視聴者同士でAIについて語り合えるコミュニティ。",
    icon: "discord",
    href: "https://discord.gg/AkhnVsWKSb",
    external: true,
  },
  {
    title: "Newsletter",
    body: "限定コラムや最新の業界をメールでお届けします。",
    icon: "mail",
    href: "#newsletter",
    external: false,
  },
];

type LatestVideo = typeof latestVideoFallback;

function decodeXmlText(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([\da-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/&amp;/g, "&")
    .trim();
}

function extractTagText(xml: string, tagName: string) {
  const match = xml.match(
    new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`),
  );

  return match?.[1] ? decodeXmlText(match[1]) : "";
}

function extractAlternateLink(entryXml: string) {
  const match = entryXml.match(
    /<link\s+[^>]*rel="alternate"[^>]*href="([^"]+)"/,
  );

  return match?.[1] ? decodeXmlText(match[1]) : "";
}

function summarizeDescription(description: string) {
  const cleaned = description
    .replace(/[\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\r/g, "")
    .trim();
  const firstBlock = cleaned
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .find(Boolean);
  const summary = firstBlock || cleaned;

  return summary.length > 180 ? `${summary.slice(0, 180)}...` : summary;
}

function parseLatestVideoFeed(xml: string): LatestVideo | null {
  const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/)?.[1];

  if (!entry) {
    return null;
  }

  const videoId = extractTagText(entry, "yt:videoId");
  const title = extractTagText(entry, "title");
  const description = summarizeDescription(
    extractTagText(entry, "media:description"),
  );
  const publishedAt = extractTagText(entry, "published");
  const url = extractAlternateLink(entry);

  if (!videoId || !title || !url) {
    return null;
  }

  return {
    description: description || latestVideoFallback.description,
    publishedAt: publishedAt || latestVideoFallback.publishedAt,
    title,
    url,
    videoId,
  };
}

async function getLatestVideo(): Promise<LatestVideo> {
  try {
    const response = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${youtubeChannelId}`,
      {
        headers: {
          accept: "application/atom+xml, application/xml;q=0.9, text/xml;q=0.8",
        },
        next: { revalidate: 60 * 60 },
      },
    );

    if (!response.ok) {
      return latestVideoFallback;
    }

    return parseLatestVideoFeed(await response.text()) || latestVideoFallback;
  } catch {
    return latestVideoFallback;
  }
}

function formatPublishedDate(publishedAt: string) {
  const date = new Date(publishedAt);

  if (Number.isNaN(date.getTime())) {
    return publishedAt;
  }

  return new Intl.DateTimeFormat("ja-JP", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function HeroBackground() {
  return (
    <div className="hero-background" aria-hidden="true">
      <Image
        className="hero-image"
        src="/assets/dotcraft-hero-bg.png"
        alt=""
        fill
        preload
        sizes="100vw"
      />
    </div>
  );
}

function AboutHostCard({ host }: { host: (typeof aboutHosts)[number] }) {
  return (
    <article className="about-host-card">
      <div className="about-host-image">
        <Image
          src={host.image}
          alt={host.alt}
          fill
          sizes="(max-width: 640px) calc(100vw - 76px), (max-width: 840px) 42vw, 220px"
        />
      </div>
      <h3>{host.name}</h3>
      <a
        className="host-social-link"
        href={host.xUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`${host.name}のXアカウント`}
      >
        <Image
          className="host-social-icon"
          src="/assets/icons/x.svg"
          alt=""
          width={14}
          height={14}
          aria-hidden="true"
        />
        <span>{host.xHandle}</span>
      </a>
    </article>
  );
}

function VideoPreview({ video }: { video: LatestVideo }) {
  const thumbnailUrl = `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`;

  return (
    <a
      className="video-preview"
      href={video.url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${video.title}をYouTubeで視聴`}
    >
      <Image
        className="video-thumbnail"
        src={thumbnailUrl}
        alt=""
        width={1280}
        height={720}
        sizes="(max-width: 840px) 100vw, 47vw"
      />
      <span className="video-preview-brand">.craft</span>
      <span className="video-preview-title">
        <span>【Loop Engineering】</span>
        <span>ループエンジニアリングとは何か？</span>
      </span>
      <span className="video-preview-subtitle">
        ソフトウェア開発の完全自動化は近い
      </span>
      <span className="youtube-play" aria-hidden="true">
        <Play size={34} fill="currentColor" strokeWidth={0} />
      </span>
    </a>
  );
}

function ContentIcon({ icon }: { icon: (typeof contentLinks)[number]["icon"] }) {
  return (
    <Image
      className={`content-icon-image ${icon}`}
      src={`/assets/icons/${icon}.svg`}
      alt=""
      width={96}
      height={96}
      aria-hidden="true"
    />
  );
}

export default async function Home() {
  const latestVideo = await getLatestVideo();

  return (
    <main className="site-shell">
      <SiteHeader navItems={navItems} youtubeUrl={youtubeChannelUrl} />

      <section id="top" className="hero-section">
        <HeroBackground />
        <div className="hero-copy">
          <h1>
            知識を点に、
            <br />
            思考を地図に。
          </h1>
          <p className="hero-lead">
            <span>思考の種を生むテクノロジーメディア</span>
          </p>
          <p className="hero-body">
            AI技術の本質や活用方法、社会への影響、働き方や創造性の変化、最新テクノロジーの動向まで。ばらばらに見える知識の点を打ち込み、問いによってつなぎ直すことで、未来を読み解くための思考の地図を育てていきます。
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="#video">
              <CirclePlay size={20} />
              最新動画を見る
            </a>
            <a className="outline-button" href={youtubeChannelUrl} target="_blank" rel="noreferrer">
              <SquarePlay size={20} />
              YouTubeへ
              <ArrowRight size={22} />
            </a>
          </div>
        </div>
      </section>

      <section id="about" className="section about-section">
        <div className="about-layout">
          <div className="about-copy">
            <p className="section-kicker">About</p>
            <h2>
              <span className="about-title-line">
                <span>AI時代の</span>
                <span>当たり前を疑う</span>
              </span>
              <br />
              2人のホスト
            </h2>
            <p>
              AIで何が便利になるのかだけでなく、何をつくるべきか、どう働くべきかまで問い直します。
            </p>
            <p>
              2人のホストが、技術と社会の変化を行き来しながら、AI時代の思考と実践を掘り下げます。
            </p>
          </div>
          <div className="about-hosts" aria-label="ホスト">
            {aboutHosts.map((host) => (
              <AboutHostCard host={host} key={host.name} />
            ))}
          </div>
          <aside className="company-panel" aria-label="運営会社">
            <p className="section-kicker">運営会社</p>
            <h3>CordMark株式会社</h3>
            <p>
              わたしたちCordMarkは、企業の意思決定・業務プロセス・プロダクト開発を、
              AI前提の構造へ再設計するAI Native Studioです。
            </p>
            <p>
              生成AI、AI Agent、業務自動化、データ基盤の実装を通じて、
              現場で使われ続けるAI Nativeな仕組みをつくっていきます。
            </p>
            <a className="company-link" href="https://cordmark.co.jp/" target="_blank" rel="noreferrer">
              会社サイトへ
              <ArrowRight size={22} />
            </a>
          </aside>
        </div>
      </section>

      <section id="video" className="section video-section">
        <div className="section-heading video-heading">
          <p className="section-kicker">Latest Video</p>
          <h2>最新の動画</h2>
        </div>
        <div className="video-grid">
          <VideoPreview video={latestVideo} />
          <div className="video-copy">
            <h3>{latestVideo.title}</h3>
            <p>{latestVideo.description}</p>
            <div className="video-meta">
              <span>
                <Calendar size={18} />
                {formatPublishedDate(latestVideo.publishedAt)}
              </span>
            </div>
            <a className="primary-button compact" href={latestVideo.url} target="_blank" rel="noreferrer">
              YouTubeで視聴
              <ExternalLink size={18} />
            </a>
          </div>
        </div>
      </section>

      <section id="contents" className="section contents-section">
        <div className="section-heading contents-heading">
          <p className="section-kicker">Connect</p>
          <h2>DotCraftとつながる</h2>
        </div>
        <div className="content-grid">
          {contentLinks.map((item) => {
            return (
              <a
                className="content-card"
                href={item.href}
                key={item.title}
                rel={item.external ? "noreferrer" : undefined}
                target={item.external ? "_blank" : undefined}
              >
                <span className="content-icon">
                  <ContentIcon icon={item.icon} />
                </span>
                <span className="content-card-copy">
                  <strong>{item.title}</strong>
                  {item.body}
                </span>
                <ArrowRight className="content-arrow" size={22} />
              </a>
            );
          })}
        </div>
      </section>

      <section id="newsletter" className="section newsletter-section">
        <div className="mail-illustration" aria-hidden="true">
          <Mail size={44} />
        </div>
        <div className="newsletter-copy">
          <p className="section-kicker">Newsletter</p>
          <h2>最新の知見をメールでお届け</h2>
          <p>
            限定コラムや最新の業界動向、イベント情報などを
            <br />
            いち早くお届けします。
          </p>
        </div>
        <NewsletterForm />
      </section>

      <section id="contact" className="section contact-section">
        <div className="contact-copy">
          <p className="section-kicker">Contact</p>
          <h2>Contact Us</h2>
          <p>
            コラボレーション、取材・メディア掲載、講演・登壇のご依頼など、
            お気軽にご連絡ください。
          </p>
        </div>
        <ContactForm />
      </section>

      <SiteFooter navItems={navItems} youtubeUrl={youtubeChannelUrl} />
    </main>
  );
}
