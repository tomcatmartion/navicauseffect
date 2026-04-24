"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";
import type { IFunctionalPalace } from "iztro/lib/astro/FunctionalPalace";
import type { IFunctionalHoroscope } from "iztro/lib/astro/FunctionalHoroscope";
import type { HoroscopeItem } from "iztro/lib/data/types/astro";
import type { IFunctionalStar } from "iztro/lib/star/FunctionalStar";

export type ScopeType =
  | "origin"
  | "decadal"
  | "yearly"
  | "monthly"
  | "daily"
  | "hourly";

interface AstrolabeDisplayProps {
  data: IFunctionalAstrolabe;
  trueSolarTimeInfo?: string;
  scope?: ScopeType;
  horoscope?: IFunctionalHoroscope | null;
}

const BRANCH_TO_GRID: Record<string, { row: number; col: number }> = {
  "寅": { row: 3, col: 0 },
  "卯": { row: 2, col: 0 },
  "辰": { row: 1, col: 0 },
  "巳": { row: 0, col: 0 },
  "午": { row: 0, col: 1 },
  "未": { row: 0, col: 2 },
  "申": { row: 0, col: 3 },
  "酉": { row: 1, col: 3 },
  "戌": { row: 2, col: 3 },
  "亥": { row: 3, col: 3 },
  "子": { row: 3, col: 2 },
  "丑": { row: 3, col: 1 },
};

const SCOPE_LABELS: Record<Exclude<ScopeType, "origin">, string> = {
  decadal: "大限",
  yearly: "流年",
  monthly: "流月",
  daily: "流日",
  hourly: "流时",
};

function getGridPosition(palace: IFunctionalPalace) {
  return BRANCH_TO_GRID[palace.earthlyBranch] || { row: 0, col: 0 };
}

function starTypeColor(type: string) {
  switch (type) {
    case "major":
      return "text-red-700 font-bold";
    case "soft":
      return "text-blue-600";
    case "tough":
      return "text-orange-600";
    case "adjective":
      return "text-violet-500";
    case "helper":
      return "text-teal-600";
    case "lucun":
    case "tianma":
      return "text-emerald-600 font-semibold";
    case "flower":
      return "text-pink-500";
    default:
      return "text-gray-500";
  }
}

function getFlowStarsForNatalPalace(
  scopeItem: HoroscopeItem | undefined,
  natalPalaceIndex: number
): IFunctionalStar[] {
  if (!scopeItem?.stars || scopeItem.stars.length === 0) return [];
  const index = scopeItem.index;
  const scopeIndex = (natalPalaceIndex - index + 12) % 12;
  const stars = scopeItem.stars[scopeIndex];
  return stars ?? [];
}

interface PalaceCellProps {
  palace: IFunctionalPalace;
  flowStars?: IFunctionalStar[];
  showFlowStars?: boolean;
}

function PalaceCell({ palace, flowStars = [], showFlowStars = false }: PalaceCellProps) {
  const pos = getGridPosition(palace);

  const agesRange =
    palace.ages && palace.ages.length > 0
      ? `${Math.min(...palace.ages)}~${Math.max(...palace.ages)}`
      : null;

  const decadalRange = palace.decadal?.range
    ? `${palace.decadal.range[0]}~${palace.decadal.range[1]}`
    : null;

  return (
    <div
      className={cn(
        "relative flex flex-col border border-primary/15 bg-card p-1.5 text-[10px] leading-tight transition-all hover:bg-primary/5 sm:p-2 sm:text-xs",
        palace.name === "命宫" && "ring-2 ring-primary/30"
      )}
      style={{
        gridRow: pos.row + 1,
        gridColumn: pos.col + 1,
      }}
    >
      <div className="mb-1 flex items-center justify-between">
        <span className="font-semibold text-primary">{palace.name}</span>
        <span className="text-[9px] text-muted-foreground">
          {palace.heavenlyStem}{palace.earthlyBranch}
        </span>
      </div>

      {palace.isBodyPalace && (
        <Badge variant="outline" className="mb-0.5 h-4 w-fit px-1 text-[8px] border-pink-300 text-pink-600">
          身宫
        </Badge>
      )}

      <div className="flex flex-wrap gap-x-1 gap-y-0.5">
        {palace.majorStars.map((star, i) => (
          <span key={`m-${i}`} className={cn("whitespace-nowrap", starTypeColor(star.type))}>
            {star.name}
            {star.brightness && (
              <sup className="text-[7px] text-muted-foreground">{star.brightness}</sup>
            )}
            {star.mutagen && (
              <sup className="text-[7px] text-amber-600">{star.mutagen}</sup>
            )}
          </span>
        ))}
      </div>

      <div className="mt-0.5 flex flex-wrap gap-x-1 gap-y-0.5">
        {palace.minorStars.map((star, i) => (
          <span key={`n-${i}`} className={cn("whitespace-nowrap", starTypeColor(star.type))}>
            {star.name}
            {star.mutagen && (
              <sup className="text-[7px] text-amber-600">{star.mutagen}</sup>
            )}
          </span>
        ))}
      </div>

      {palace.adjectiveStars.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-x-1 gap-y-0.5">
          {palace.adjectiveStars.map((star, i) => (
            <span key={`a-${i}`} className={cn("whitespace-nowrap text-[9px]", starTypeColor(star.type))}>
              {star.name}
            </span>
          ))}
        </div>
      )}

      {showFlowStars && flowStars.length > 0 && (
        <div className="mt-1 border-t border-primary/10 pt-0.5">
          <span className="text-[8px] text-muted-foreground">流耀：</span>
          <div className="flex flex-wrap gap-x-1 gap-y-0.5">
            {flowStars.map((star, i) => (
              <span
                key={`f-${i}`}
                className={cn("whitespace-nowrap text-[9px]", starTypeColor(star.type ?? "adjective"))}
              >
                {star.name}
                {star.mutagen && (
                  <sup className="text-[7px] text-amber-600">{star.mutagen}</sup>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto pt-1 flex justify-between text-[8px] text-muted-foreground">
        {decadalRange && <span>限 {decadalRange}</span>}
        {agesRange && <span>限 {agesRange}</span>}
      </div>
    </div>
  );
}

export function AstrolabeDisplay({
  data,
  trueSolarTimeInfo,
  scope = "origin",
  horoscope = null,
}: AstrolabeDisplayProps) {
  const isOrigin = scope === "origin";
  const scopeItem =
    !isOrigin && horoscope
      ? (horoscope[scope] as HoroscopeItem | undefined)
      : undefined;

  return (
    <Card className="border-primary/15 overflow-hidden">
      <CardContent className="p-3 sm:p-4">
        <div className="grid grid-cols-[repeat(4,1fr)] grid-rows-[repeat(4,1fr)] gap-0">
          {data.palaces.map((palace, i) => (
            <PalaceCell
              key={i}
              palace={palace}
              flowStars={getFlowStarsForNatalPalace(scopeItem, i)}
              showFlowStars={!isOrigin && !!scopeItem}
            />
          ))}

          <div
            className="flex flex-col items-center justify-center border border-primary/15 bg-gradient-to-br from-primary/5 to-accent/5 p-3 text-center"
            style={{ gridRow: "2 / 4", gridColumn: "2 / 4" }}
          >
            {isOrigin ? (
              <>
                <h3 className="mb-2 font-[var(--font-serif-sc)] text-lg font-bold text-primary sm:text-xl">
                  紫微命盘
                </h3>
                <div className="space-y-1 text-xs sm:text-sm">
                  <p>
                    <span className="text-muted-foreground">阳历：</span>
                    {data.solarDate}
                  </p>
                  <p>
                    <span className="text-muted-foreground">农历：</span>
                    {data.lunarDate}
                  </p>
                  <p>
                    <span className="text-muted-foreground">四柱：</span>
                    {data.chineseDate}
                  </p>
                  <p>
                    <span className="text-muted-foreground">时辰：</span>
                    {data.time} ({data.timeRange})
                  </p>
                  {trueSolarTimeInfo && (
                    <p className="text-[10px] text-accent-foreground/60">
                      {trueSolarTimeInfo}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
                    <Badge variant="secondary">{data.sign}</Badge>
                    <Badge variant="secondary">生肖{data.zodiac}</Badge>
                    <Badge variant="secondary">{data.fiveElementsClass}</Badge>
                  </div>
                  <div className="flex flex-wrap justify-center gap-2 text-xs">
                    <Badge variant="outline" className="border-primary/30">命主 {data.soul}</Badge>
                    <Badge variant="outline" className="border-primary/30">身主 {data.body}</Badge>
                  </div>
                </div>
              </>
            ) : scopeItem ? (
              <>
                <h3 className="mb-2 font-[var(--font-serif-sc)] text-lg font-bold text-primary sm:text-xl">
                  {SCOPE_LABELS[scope]}
                </h3>
                <div className="space-y-1 text-xs sm:text-sm">
                  <p>
                    <span className="text-muted-foreground">干支：</span>
                    {scopeItem.heavenlyStem}{scopeItem.earthlyBranch}
                  </p>
                  {scopeItem.mutagen && scopeItem.mutagen.length > 0 && (
                    <p>
                      <span className="text-muted-foreground">四化：</span>
                      {scopeItem.mutagen.join("、")}
                    </p>
                  )}
                </div>
              </>
            ) : (
              <h3 className="font-[var(--font-serif-sc)] text-lg font-bold text-primary sm:text-xl">
                {SCOPE_LABELS[scope]}
              </h3>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
