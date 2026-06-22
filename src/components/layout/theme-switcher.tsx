"use client";

import { useTheme, type ZiweiTheme } from "@/components/providers/theme-provider";

interface ThemeOption {
  key: ZiweiTheme;
  label: string;
  /** 切换按钮显示的颜色（来自 testUI/js/theme.js） */
  color: string;
}

const OPTIONS: ThemeOption[] = [
  { key: "newspaper", label: "报纸主题", color: "#F2ECD9" },
  { key: "clay", label: "粘土主题", color: "#F5F2EF" },
  { key: "neumorphism", label: "新拟态主题", color: "#E0E5EC" },
];

/**
 * 右下角悬浮三主题切换器。
 * DOM 结构与 testUI 的 .theme-switcher 完全一致（CSS 来自 ziwei.css）。
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="主题切换">
      {OPTIONS.map((opt) => {
        const isActive = theme === opt.key;
        return (
          <button
            key={opt.key}
            type="button"
            className={isActive ? "active" : undefined}
            style={{ background: opt.color }}
            title={opt.label}
            aria-label={opt.label}
            aria-pressed={isActive}
            onClick={() => setTheme(opt.key)}
          />
        );
      })}
    </div>
  );
}
