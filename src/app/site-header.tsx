import { BrandLogo } from "./brand-logo";
import { MobileMenu } from "./mobile-menu";
import { SquarePlay } from "lucide-react";

type SiteHeaderProps = {
  homeHref?: string;
  navBaseHref?: string;
  navItems: string[];
  youtubeUrl: string;
};

function navHref(item: string, baseHref: string) {
  return `${baseHref}#${item.toLowerCase()}`;
}

export function SiteHeader({
  homeHref = "#top",
  navBaseHref = "",
  navItems,
  youtubeUrl,
}: SiteHeaderProps) {
  const menuItems = navItems;

  return (
    <>
      <header className="site-header">
        <a className="brand" href={homeHref} aria-label="DotCraft ホーム">
          <BrandLogo className="header-brand-logo" />
        </a>

        <div className="header-actions">
          <nav className="nav-links" aria-label="メインナビゲーション">
            {menuItems.map((item) => (
              <a key={item} href={navHref(item, navBaseHref)}>
                {item}
              </a>
            ))}
          </nav>
          <a
            className="header-youtube-button"
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
          >
            <SquarePlay size={18} />
            YouTubeへ
          </a>
        </div>

        <MobileMenu navBaseHref={navBaseHref} navItems={menuItems} youtubeUrl={youtubeUrl} />
      </header>
    </>
  );
}
