import type { ZiweiTheme } from "@/components/providers/theme-provider";

/**
 * 主题元数据（key/label/短标/desc/演示色）。
 *
 * theme-switcher.tsx 和 settings/page.tsx 共用此常量,
 * 避免主题色值散落在多处导致不一致。
 *
 * 演示色（color）取自 testUI/js/theme.js,
 * 与 ziwei.css 中各主题 [data-theme="xxx"] 的 --bg 保持一致。
 *
 * 顺序：粘土风 → 新拟态 → 报纸（与产品默认顺序一致）。
 */
export interface ThemeOption {
  key: ZiweiTheme;
  /** 完整名称（settings 页展示） */
  label: string;
  /** 单字简称（theme-switcher 浮球展示） */
  shortLabel: string;
  /** 短描述（settings 页展示） */
  desc: string;
  /** 主题演示色（用于色块预览,等于各主题 --bg） */
  color: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    key: "clay",
    label: "粘土风",
    shortLabel: "土",
    desc: "暖米色 + 棕褐 · 圆角 14-30px · 柔和浮雕",
    color: "#F5F2EF",
  },
  {
    key: "neumorphism",
    label: "新拟态",
    shortLabel: "拟",
    desc: "冷灰 + 蓝青 · 圆角 10-24px · 极简",
    color: "#E0E5EC",
  },
  {
    key: "newspaper",
    label: "报纸主题",
    shortLabel: "报",
    desc: "米黄 + 朱砂 · 圆角 4px · 东方典雅",
    color: "#F2ECD9",
  },
];

/** 兼容旧引用：即全部具体主题 */
export const CONCRETE_THEMES: ThemeOption[] = THEME_OPTIONS;
