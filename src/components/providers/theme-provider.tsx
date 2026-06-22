"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

/**
 * 三主题 Provider：data-theme="newspaper" | "clay" | "neumorphism"
 *
 * 设计要点（与 testUI/js/theme.js 对齐）：
 *  - localStorage 持久化（key: zw-theme），默认 newspaper
 *  - 切换前给 <html> 加 .theme-switching 类禁用所有过渡，双 RAF 后移除
 *  - <html data-theme="xxx"> 属性由本 Provider 维护，SSR 时通过 inline script 注入初始值
 *    避免水合闪烁（layout.tsx 已配置 suppressHydrationWarning）
 *
 * 替换了原本的 next-themes（dark/light 二态），三主题都是浅色基调。
 * Sonner 等依赖 useTheme 的组件应直接传 theme="light"。
 */

export type ZiweiTheme = "newspaper" | "clay" | "neumorphism";

const STORAGE_KEY = "zw-theme";
const DEFAULT_THEME: ZiweiTheme = "newspaper";
const VALID_THEMES: ZiweiTheme[] = ["newspaper", "clay", "neumorphism"];

interface ThemeContextValue {
  theme: ZiweiTheme;
  setTheme: (next: ZiweiTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function isValidTheme(value: string | null): value is ZiweiTheme {
  return value !== null && (VALID_THEMES as string[]).includes(value);
}

function readStoredTheme(): ZiweiTheme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return isValidTheme(stored) ? stored : DEFAULT_THEME;
}

function applyTheme(next: ZiweiTheme, persist = true) {
  const root = document.documentElement;
  // 切换前禁用所有过渡，避免 box-shadow/color 同步过渡造成视觉混淆
  root.classList.add("theme-switching");
  root.setAttribute("data-theme", next);
  if (persist) {
    window.localStorage.setItem(STORAGE_KEY, next);
  }
  // 双 RAF 后恢复 transition（确保浏览器先把新主题应用到元素上）
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.classList.remove("theme-switching");
    });
  });
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // SSR 与首次客户端渲染都返回 DEFAULT_THEME，避免水合不匹配；
  // 挂载后从 localStorage 读取真实值并 apply。
  const [theme, setThemeState] = useState<ZiweiTheme>(DEFAULT_THEME);

  useEffect(() => {
    const stored = readStoredTheme();
    if (stored !== DEFAULT_THEME) {
      setThemeState(stored);
      applyTheme(stored);
    } else {
      // 确保首次进入也写入 data-theme（HTML 上 suppressHydrationWarning 已配置）
      applyTheme(DEFAULT_THEME);
    }
  }, []);

  const setTheme = useCallback((next: ZiweiTheme) => {
    setThemeState(next);
    applyTheme(next);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 兜底：组件在 Provider 外被使用时返回 no-op，避免崩溃
    return {
      theme: DEFAULT_THEME,
      setTheme: () => {
        /* no-op */
      },
    };
  }
  return ctx;
}
