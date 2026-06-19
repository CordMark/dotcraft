import Link from "next/link";
import { Mail, Send, SquarePlay } from "lucide-react";
import { BrandLogo } from "./brand-logo";

type SiteFooterProps = {
  currentPage?: "privacy";
  homeHref?: string;
  navBaseHref?: string;
  navItems: string[];
  youtubeUrl: string;
};

function navHref(item: string, baseHref: string) {
  return `${baseHref}#${item.toLowerCase()}`;
}

export function SiteFooter({
  currentPage,
  homeHref = "#top",
  navBaseHref = "",
  navItems,
  youtubeUrl,
}: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand footer-brand" href={homeHref} aria-label="DotCraft ホーム">
          <BrandLogo />
        </Link>
        <p>知識の点を問いでつなぎ、AI時代の思考の地図を育てる。</p>
        <div className="footer-social">
          <a href={youtubeUrl} target="_blank" rel="noreferrer" aria-label="YouTube">
            <SquarePlay size={18} />
          </a>
          <a href="https://x.com/dot_craft_" target="_blank" rel="noreferrer" aria-label="X">
            <Send size={18} />
          </a>
          <Link href={navHref("Newsletter", navBaseHref)} aria-label="Newsletter">
            <Mail size={18} />
          </Link>
        </div>
      </div>
      <div className="footer-links">
        {navItems.map((item) => (
          <Link key={item} href={navHref(item, navBaseHref)}>
            {item}
          </Link>
        ))}
        {currentPage === "privacy" ? (
          <span aria-current="page">プライバシーポリシー</span>
        ) : (
          <Link href="/privacy-policy">プライバシーポリシー</Link>
        )}
        <span>特定商取引法に基づく表記</span>
      </div>
      <p className="copyright">© 2026 DotCraft. All Rights Reserved.</p>
    </footer>
  );
}
