"use client";

import { useState, useEffect } from "react";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAge: number, path: string) {
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAge}; path=${path}`;
}

export default function LanguageToggle() {
  const [locale, setLocale] = useState<"en" | "fr">("en");

  useEffect(() => {
    const saved = getCookie("NEXT_LOCALE");
    if (saved === "fr" || saved === "en") {
      setLocale(saved);
    }
  }, []);

  const handleToggle = (lang: "en" | "fr") => {
    if (lang === locale) return;
    setCookie("NEXT_LOCALE", lang, 31536000, "/");
    setLocale(lang);
    window.location.reload();
  };

  const activeStyle: React.CSSProperties = {
    color: "var(--primary-color, #4A919E)",
    fontWeight: "700",
    cursor: "default",
  };

  const inactiveStyle: React.CSSProperties = {
    color: "#94a3b8",
    fontWeight: "400",
    cursor: "pointer",
  };

  const separatorStyle: React.CSSProperties = {
    color: "#cbd5e1",
    margin: "0 4px",
    userSelect: "none",
  };

  return (
    <button
      style={{
        display: "inline-flex",
        alignItems: "center",
        background: "transparent",
        border: "none",
        padding: "4px 8px",
        fontSize: "0.85rem",
        letterSpacing: "0.05em",
        fontFamily: "inherit",
        outline: "none",
        cursor: "default",
      }}
      aria-label="Switch language / Changer de langue"
    >
      <span
        style={locale === "en" ? activeStyle : inactiveStyle}
        onClick={() => handleToggle("en")}
      >
        EN
      </span>
      <span style={separatorStyle}>|</span>
      <span
        style={locale === "fr" ? activeStyle : inactiveStyle}
        onClick={() => handleToggle("fr")}
      >
        FR
      </span>
    </button>
  );
}
