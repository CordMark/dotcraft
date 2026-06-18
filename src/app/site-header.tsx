"use client";

import { Menu, SquarePlay, X } from "lucide-react";
import { useState } from "react";

type SiteHeaderProps = {
  navItems: string[];
  youtubeUrl: string;
};

function navHref(item: string) {
  return `#${item.toLowerCase()}`;
}

export function SiteHeader({ navItems, youtubeUrl }: SiteHeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuItems = navItems;

  const closeMenu = () => setIsMenuOpen(false);

  return (
    <>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="DotCraft ホーム" onClick={closeMenu}>
          <span className="brand-wordmark" aria-hidden="true">
            <span className="brand-dot" />
            <span>DotCraft</span>
          </span>
        </a>

        <div className="header-actions">
          <nav className="nav-links" aria-label="メインナビゲーション">
            {menuItems.map((item) => (
              <a key={item} href={navHref(item)}>
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

        <button
          className="menu-button"
          type="button"
          aria-label={isMenuOpen ? "メニューを閉じる" : "メニューを開く"}
          aria-controls="mobile-menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X size={42} strokeWidth={2} /> : <Menu size={42} strokeWidth={2.4} />}
        </button>
      </header>

      <div
        className={`mobile-menu${isMenuOpen ? " is-open" : ""}`}
        id="mobile-menu"
        aria-hidden={!isMenuOpen}
      >
        <button
          className="mobile-menu-backdrop"
          type="button"
          aria-label="メニューを閉じる"
          tabIndex={isMenuOpen ? 0 : -1}
          onClick={closeMenu}
        />
        <aside className="mobile-menu-panel" aria-label="メインナビゲーション">
          <button
            className="mobile-close-button"
            type="button"
            aria-label="メニューを閉じる"
            onClick={closeMenu}
          >
            <X size={30} strokeWidth={2.2} />
          </button>
          <nav className="mobile-nav-links">
            {menuItems.map((item) => (
              <a key={item} href={navHref(item)} onClick={closeMenu}>
                {item}
              </a>
            ))}
          </nav>
          <a
            className="header-youtube-button mobile-youtube-button"
            href={youtubeUrl}
            target="_blank"
            rel="noreferrer"
            onClick={closeMenu}
          >
            <SquarePlay size={18} />
            YouTubeへ
          </a>
        </aside>
      </div>
    </>
  );
}
