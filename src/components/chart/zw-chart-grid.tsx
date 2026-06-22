"use client";

import { useMemo } from "react";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";
import type { IFunctionalPalace } from "iztro/lib/astro/FunctionalPalace";
import type { IFunctionalHoroscope } from "iztro/lib/astro/FunctionalHoroscope";

/**
 * 紫微斗数 12 宫方阵（4×4 grid，含 4 个 .zw-center）。
 *
 * DOM 与 testUI/desktop/chart-detail.html 的 .zw-chart 完全对齐：
 *   <div class="zw-chart">
 *     <div class="zw-cell[.life|.current]">
 *       <div class="zw-cell-head"><span class="zw-dizhi">巳</span><span class="zw-gong">父母</span></div>
 *       <div class="zw-stars"><div class="zw-star[.ziwei|.sun|.moon]">紫微</div>...</div>
 *       <div class="zw-fu">左辅 · 文昌</div>
 *       <div class="zw-daxian">大运 24-33</div>
 *     </div>
 *     <div class="zw-center">
 *       <div class="zw-center-gua">☰</div>
 *       <div class="zw-center-name">林生</div>
 *       <div class="zw-center-meta">阳男 · 土五局</div>
 *     </div>
 *     ...
 *   </div>
 *
 * CSS 来自 src/styles/ziwei/ziwei.css 的 .zw-chart / .zw-cell / .zw-center 等。
 */

// 4×4 grid 位置映射（row * 4 + col），按地支
// 布局（与 testUI/desktop/chart-detail.html 对齐）：
//   巳 午 未 申
//   辰 ★ ★ 酉
//   卯 ★ ★ 戌
//   寅 丑 子 亥
const EARTHLY_BRANCH_TO_POSITION: Record<string, number> = {
  巳: 0,
  午: 1,
  未: 2,
  申: 3,
  辰: 4,
  酉: 7,
  卯: 8,
  戌: 11,
  寅: 12,
  丑: 13,
  子: 14,
  亥: 15,
};

// 4 个 .zw-center 位置（5/6/9/10），按 testUI 顺序：
// 5=命卦/命主信息，6=身宫，9=四化，10=局数
const CENTER_POSITIONS = [5, 6, 9, 10];

// 星曜的视觉修饰类（与 testUI .zw-star.ziwei / .sun / .moon 对齐）
const STAR_MODIFIER_CLASS: Record<string, string> = {
  紫微: "ziwei",
  太阳: "sun",
  太阴: "moon",
};

// 八卦符号（占位用，真实命卦需 iztro 计算或外部传入）
const BAGUA = ["☰", "☷", "☲", "☵"];

export interface ZwChartGridProps {
  astrolabe: IFunctionalAstrolabe;
  horoscope?: IFunctionalHoroscope | null;
  /** 命宫地支（用于 .zw-cell.life 标记），不传则自动从 astrolabe 推断 */
  lifePalaceEarthlyBranch?: string;
  /** 当前流年命宫地支（用于 .zw-cell.current 标记） */
  currentYearEarthlyBranch?: string;
  /** 命主姓名（显示在中心格） */
  nativeName?: string;
}

interface StarItem {
  name: string;
  modifier?: string;
  /** 四化标记：化禄/化权/化科/化忌 */
  mutagen?: string;
}

function extractStars(palace: IFunctionalPalace): {
  majors: StarItem[];
  minors: StarItem[];
} {
  const majors: StarItem[] = (palace.majorStars || [])
    .filter((s) => s && s.name)
    .map((s) => ({
      name: s.name as string,
      modifier: STAR_MODIFIER_CLASS[s.name as string],
      mutagen: s.mutagen as string | undefined,
    }));
  const minors: StarItem[] = (palace.minorStars || [])
    .filter((s) => s && s.name)
    .map((s) => ({
      name: s.name as string,
      mutagen: s.mutagen as string | undefined,
    }));
  return { majors, minors };
}

function daxianLabel(palace: IFunctionalPalace): string {
  const decadal = palace.decadal as
    | { range?: [number, number]; heavenlyStem?: string }
    | undefined;
  if (!decadal?.range) return "";
  const [start, end] = decadal.range;
  return `大运 ${start}-${end}`;
}

export function ZwChartGrid({
  astrolabe,
  horoscope,
  lifePalaceEarthlyBranch,
  currentYearEarthlyBranch,
  nativeName,
}: ZwChartGridProps) {
  const layout = useMemo(() => {
    // 12 宫按地支放入 16 格 grid
    const cells: Array<{
      pos: number;
      palace: IFunctionalPalace;
      isLife: boolean;
      isCurrent: boolean;
    } | null> = new Array(16).fill(null);

    // 推断命宫地支：优先用 prop，其次 astrolabe.earthlyBranchOfSoulPalace
    const lifeBranch =
      lifePalaceEarthlyBranch ||
      (astrolabe as { earthlyBranchOfSoulPalace?: string })
        .earthlyBranchOfSoulPalace;

    for (const palace of astrolabe.palaces) {
      const branch = palace.earthlyBranch as string;
      const pos = EARTHLY_BRANCH_TO_POSITION[branch];
      if (pos === undefined) continue;
      cells[pos] = {
        pos,
        palace,
        isLife: !!lifeBranch && branch === lifeBranch,
        isCurrent:
          !!currentYearEarthlyBranch && branch === currentYearEarthlyBranch,
      };
    }

    return cells;
  }, [astrolabe, lifePalaceEarthlyBranch, currentYearEarthlyBranch]);

  // 中心格内容（4 个）：命主信息 / 身宫 / 四化 / 局数
  const centers = useMemo(() => {
    const a = astrolabe as unknown as {
      name?: string;
      gender?: string;
      fiveElementsClass?: string;
      solarDate?: string;
      soul?: string;
      body?: string;
      earthlyBranchOfBodyPalace?: string;
    };
    // 生年四化（从 horoscope 或 majorStars 的 mutagen 提取）
    const sihua: string[] = [];
    const seen = new Set<string>();
    for (const palace of astrolabe.palaces) {
      for (const s of [
        ...palace.majorStars,
        ...palace.minorStars,
      ]) {
        const m = s.mutagen as string | undefined;
        if (m && !seen.has(m)) {
          sihua.push(`${m} ${s.name}`);
          seen.add(m);
        }
      }
    }

    return [
      {
        gua: BAGUA[0],
        name: nativeName || a.name || "命主",
        metas: [
          `${a.gender === "男" ? "阳男" : "阴女"} · ${a.fiveElementsClass || ""}`,
          a.solarDate || "",
        ].filter(Boolean),
      },
      {
        gua: BAGUA[1],
        name: "身宫",
        metas: [
          a.earthlyBranchOfBodyPalace
            ? `地支: ${a.earthlyBranchOfBodyPalace}`
            : "",
          a.body ? `身主: ${a.body}` : "",
        ].filter(Boolean),
      },
      {
        gua: BAGUA[2],
        name: "四化",
        metas: sihua.slice(0, 2) || ["-"],
      },
      {
        gua: BAGUA[3],
        name: "局数",
        metas: [
          a.fiveElementsClass || "-",
          a.soul ? `命主: ${a.soul}` : "",
        ].filter(Boolean),
      },
    ];
  }, [astrolabe, nativeName]);

  let centerIdx = 0;

  return (
    <div className="zw-chart" role="img" aria-label="紫微命盘十二宫方阵">
      {layout.map((cell, i) => {
        // 中心格
        if (CENTER_POSITIONS.includes(i)) {
          const center = centers[centerIdx];
          centerIdx += 1;
          if (!center) return null;
          return (
            <div key={`c-${i}`} className="zw-center">
              <div className="zw-center-gua">{center.gua}</div>
              <div className="zw-center-name">{center.name}</div>
              {center.metas.map((m, idx) => (
                <div key={idx} className="zw-center-meta">
                  {m}
                </div>
              ))}
            </div>
          );
        }

        // 命盘宫位
        if (!cell) {
          // 兜底：空宫位
          return <div key={`e-${i}`} className="zw-cell" />;
        }

        const { palace, isLife, isCurrent } = cell;
        const { majors, minors } = extractStars(palace);
        const classParts = ["zw-cell"];
        if (isLife) classParts.push("life");
        if (isCurrent) classParts.push("current");
        const branch = palace.earthlyBranch as string;
        const palaceName = palace.name as string;
        const daxian = daxianLabel(palace);
        const isBody = !!palace.isBodyPalace;

        return (
          <div key={palace.index} className={classParts.join(" ")}>
            <div className="zw-cell-head">
              <span className="zw-dizhi">{branch}</span>
              <span className="zw-gong">
                {palaceName}
                {isBody && " · 身"}
              </span>
            </div>
            <div className="zw-stars">
              {majors.length === 0 ? (
                <div className="zw-star" style={{ opacity: 0.4 }}>
                  空宫
                </div>
              ) : (
                majors.map((s, idx) => (
                  <div
                    key={`mj-${idx}`}
                    className={`zw-star${s.modifier ? ` ${s.modifier}` : ""}`}
                  >
                    {s.name}
                    {s.mutagen && (
                      <span className="zw-sihua">{s.mutagen}</span>
                    )}
                  </div>
                ))
              )}
            </div>
            {minors.length > 0 && (
              <div className="zw-fu">
                {minors.map((s) => s.name).join(" · ")}
              </div>
            )}
            {daxian && <div className="zw-daxian">{daxian}</div>}
          </div>
        );
      })}
    </div>
  );
}
