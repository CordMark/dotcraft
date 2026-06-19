"use client";

import { Menu, SquarePlay, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type MobileMenuProps = {
  navBaseHref: string;
  navItems: string[];
  youtubeUrl: string;
};

function navHref(item: string, baseHref: string) {
  return `${baseHref}#${item.toLowerCase()}`;
}

const subscribeToClient = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function MobileMenu({ navBaseHref, navItems, youtubeUrl }: MobileMenuProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const canUsePortal = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot,
  );
  const closeMenu = () => setIsMenuOpen(false);

  const menuOverlay = (
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
          {navItems.map((item) => (
            <a key={item} href={navHref(item, navBaseHref)} onClick={closeMenu}>
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
  );

  return (
    <>
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

      {canUsePortal ? createPortal(menuOverlay, document.body) : null}
    </>
  );
}
