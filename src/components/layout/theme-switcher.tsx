"use client";

import { useTheme } from "@/components/providers/theme-provider";
import { CONCRETE_THEMES, THEME_OPTIONS } from "@/lib/theme/theme-options";

/**
 * 右下角悬浮主题切换器。
 * DOM 结构与 testUI 的 .theme-switcher 基本一致（CSS 来自 ziwei.css）。
 *
 * 仅展示 3 个具体主题：粘土风(土)、新拟态(拟)、报纸(报)。
 */
export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="theme-switcher" role="group" aria-label="主题切换">
      {THEME_OPTIONS.map((opt) => {
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
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "var(--ink)",
                lineHeight: 1,
                fontFamily: "var(--font-head)",
              }}
            >
              {opt.shortLabel}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// 兼容旧引用
export { CONCRETE_THEMES };
