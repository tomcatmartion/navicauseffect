"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import dynamic from "next/dynamic";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";
import type { IFunctionalHoroscope } from "iztro/lib/astro/FunctionalHoroscope";
import { BirthInputForm } from "@/components/chart/birth-input-form";
import { Button } from "@/components/ui/button";


// 重型依赖：排盘后才需要，用 dynamic import 按需加载
const Iztrolabe = dynamic(
  () =>
    import("react-iztro").then((mod) => {
      // CSS 必须在组件加载时同步引入，避免闪烁
      require("react-iztro/lib/theme/default.css");
      require("react-iztro/lib/Iztrolabe/Iztrolabe.css");
      require("react-iztro/lib/IzpalaceCenter/IzpalaceCenter.css");
      require("react-iztro/lib/Izpalace/Izpalace.css");
      return mod.Iztrolabe as unknown as React.ComponentType<Record<string, unknown>>;
    }),
  { ssr: false }
);

const ZiweiAnalysisPanel = dynamic(
  () => import("@/components/analysis/ziwei-analysis-panel").then((m) => m.ZiweiAnalysisPanel),
  { ssr: false }
);

const ChatPanel = dynamic(
  () => import("@/components/analysis/chat-panel").then((m) => m.ChatPanel),
  { ssr: false }
);

const CHART_STATE_KEY = "chart_birth_state";

// 命盘固定渲染宽度（px），缩放基于此值计算
const CHART_RENDER_WIDTH = 600;
// 命盘容器内边距（px），命盘四周留白
const CHART_PADDING = 16;

// 按需加载 iztro 排盘引擎（不在文件顶部 import，减少首屏 JS 体积）
async function getAstro() {
  const { astro } = await import("iztro");
  return astro;
}

/**
 * 预加载所有重型依赖（iztro + react-iztro + analysis 组件）
 * 在用户填写表单时后台下载，点击"生成命盘"时直接使用缓存
 */
function preloadHeavyDeps() {
  // iztro 排盘引擎（2.6MB 压缩后 ~565KB）
  import("iztro");
  // react-iztro 命盘 UI（2.6MB 压缩后 ~595KB）
  import("react-iztro");
  // AI 分析面板（1.4MB 压缩后 ~356KB）
  import("@/components/analysis/analysis-panel");
  // 规则分析面板
  import("@/components/analysis/ziwei-analysis-panel");
  // AI 对话面板
  import("@/components/analysis/chat-panel");
}

export default function ChartPage() {
  const [astrolabe, setAstrolabe] = useState<IFunctionalAstrolabe | null>(null);
  const [horoscope, setHoroscope] = useState<IFunctionalHoroscope | null>(null);
  const [trueSolarTimeInfo, setTrueSolarTimeInfo] = useState("");
  const [birthTimeIndex, setBirthTimeIndex] = useState(0);
  const [horoscopeDate, setHoroscopeDate] = useState(() => new Date());
  const [horoscopeTimeIndex, setHoroscopeTimeIndex] = useState(0);
  const [birthData, setBirthData] = useState<{
    gender: "MALE" | "FEMALE";
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;
  } | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // 命盘缩放：必须在组件顶层调用（Rules of Hooks）
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartInnerRef = useRef<HTMLDivElement>(null);
  const [chartScale, setChartScale] = useState(1);
  const [chartNaturalHeight, setChartNaturalHeight] = useState(0);

  // 监测命盘容器宽度变化，动态计算缩放比例和实际高度
  useEffect(() => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      // 容器可用宽度 = 容器总宽度 - 两侧 padding
      const availableWidth = wrapper.clientWidth - CHART_PADDING * 2;
      setChartScale(Math.min(availableWidth / CHART_RENDER_WIDTH, 1));
      // 测量命盘实际渲染高度（未缩放的自然高度）
      if (chartInnerRef.current) {
        setChartNaturalHeight(chartInnerRef.current.scrollHeight);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [astrolabe]);

  // 页面挂载后立即预加载重型依赖（用户填表时已在后台下载完）
  useEffect(() => {
    preloadHeavyDeps();
  }, []);

  // 页面加载时恢复命盘状态（按需加载 iztro）
  useEffect(() => {
    const raw = sessionStorage.getItem(CHART_STATE_KEY);
    if (!raw) return;
    (async () => {
      try {
        const saved = JSON.parse(raw);
        if (saved.solar) {
          const astro = await getAstro();
          const result = astro.bySolar(
            `${saved.year}-${String(saved.month).padStart(2, "0")}-${String(saved.day).padStart(2, "0")}`,
            saved.hour,
            saved.gender === "MALE" ? "男" : "女",
            true,
            "zh-CN"
          );
          setAstrolabe(result);
          setBirthData(saved);
          setBirthTimeIndex(saved.hour);
          setHoroscopeTimeIndex(saved.hour);
          setHoroscopeDate(new Date());
          const horo = result.horoscope(new Date(), saved.hour);
          setHoroscope(horo);
          setTrueSolarTimeInfo(saved.trueSolarTimeInfo ?? "");
        }
      } catch {
        // 恢复失败则忽略
      }
    })();
  }, []);

  // horoscope 运限由 Iztrolabe 组件内部管理（useIztro hook）
  // chart page 只维护 horoscopeDate/horoscopeTimeIndex 用于传给右侧分析面板
  // 不再自己计算 horoscope，避免与 Iztrolabe 内部 horoscope 计算冲突

  const handleGenerateChart = async (data: {
    solarDate: string;
    lunarDate?: string;
    timeIndex: number;
    gender: string;
    isLunar: boolean;
    isLeapMonth?: boolean;
    city: string;
    trueSolarTimeInfo: string;
  }) => {
    setIsGenerating(true);
    try {
      const astro = await getAstro();
      let result: IFunctionalAstrolabe;
      const genderName = data.gender as "男" | "女";

      if (data.isLunar && data.lunarDate) {
        result = astro.byLunar(
          data.lunarDate,
          data.timeIndex,
          genderName,
          data.isLeapMonth ?? false,
          true,
          "zh-CN"
        );
      } else {
        result = astro.bySolar(
          data.solarDate,
          data.timeIndex,
          genderName,
          true,
          "zh-CN"
        );
      }

      const dateMatch = data.solarDate.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
      // 构建 birthInfo（用于 state 和 sessionStorage），不依赖 dateMatch 是否存在
      const birthInfo = {
        gender: (data.gender === "男" ? "MALE" : "FEMALE") as "MALE" | "FEMALE",
        year: dateMatch ? parseInt(dateMatch[1], 10) : new Date().getFullYear(),
        month: dateMatch ? parseInt(dateMatch[2], 10) : 1,
        day: dateMatch ? parseInt(dateMatch[3], 10) : 1,
        hour: data.timeIndex,
        solar: !data.isLunar,
      };

      // 必须先 setBirthData，再渲染 AI 分析面板（否则显示"暂无出生数据"）
      setBirthData(birthInfo);

      setAstrolabe(result);
      setTrueSolarTimeInfo(data.trueSolarTimeInfo);
      setBirthTimeIndex(data.timeIndex);
      setHoroscopeTimeIndex(data.timeIndex);
      setHoroscopeDate(new Date());
      const horo = result.horoscope(new Date(), data.timeIndex);
      setHoroscope(horo);

      // 保存到 sessionStorage（用于页面刷新后恢复命盘状态）
      sessionStorage.setItem(CHART_STATE_KEY, JSON.stringify({
        ...birthInfo,
        trueSolarTimeInfo: data.trueSolarTimeInfo,
      }));
    } catch (err) {
      console.error("排盘错误:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHoroscopeDateChange = (date: string | Date) => {
    const d = typeof date === "string" ? new Date(date) : date;
    if (!Number.isNaN(d.getTime())) setHoroscopeDate(d);
  };

  const handleHoroscopeHourChange = (hour: number) => {
    setHoroscopeTimeIndex(Math.max(0, Math.min(12, hour)));
  };

  const handleReenter = () => {
    setAstrolabe(null);
    setHoroscope(null);
    setTrueSolarTimeInfo("");
    setBirthData(null);
    sessionStorage.removeItem(CHART_STATE_KEY);
  };

  // 排盘前：居中输入表单
  if (!astrolabe) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6 md:py-10">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-[var(--font-serif-sc)] text-2xl font-bold text-primary md:text-3xl">
            紫微命理排盘
          </h1>
          <p className="text-sm text-muted-foreground">
            输入出生信息，生成专属紫微命盘，解码你的生命轨迹
          </p>
        </div>
        <div className="mx-auto max-w-md">
          <BirthInputForm onSubmit={handleGenerateChart} isLoading={isGenerating} />
        </div>
      </div>
    );
  }

  // 排盘后：左右分栏（PC）或上下堆叠（移动端）
  return (
    <div className="mx-auto max-w-[1600px] px-4 py-4 md:py-6">
      {/* 标题栏 */}
      <div className="mb-4 flex items-center justify-between">
        <div className="min-w-0">
          <h1 className="font-[var(--font-serif-sc)] text-lg font-bold text-primary md:text-2xl">
            紫微命理排盘
          </h1>
          <p className="text-xs text-muted-foreground">{trueSolarTimeInfo}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReenter} className="shrink-0">
          重新排盘
        </Button>
      </div>

      {/* 主体：左右分栏 */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:items-stretch">
        {/* 左侧：命盘（transform scale 缩放） */}
        <div className="w-full md:w-[460px] md:flex-none md:self-stretch">
          <div
            ref={chartWrapperRef}
            className="rounded-lg border bg-card overflow-hidden md:h-full"
            style={{
              padding: `${CHART_PADDING}px`,
              height: chartNaturalHeight > 0 ? chartNaturalHeight * chartScale + CHART_PADDING * 2 : undefined,
            }}
          >
            <div
              ref={chartInnerRef}
              style={{
                width: `${CHART_RENDER_WIDTH}px`,
                transform: `scale(${chartScale})`,
                transformOrigin: "top left",
              }}
            >
              <Iztrolabe
                lang="zh-CN"
                birthday={astrolabe.solarDate}
                birthTime={birthTimeIndex}
                gender={astrolabe.gender as "男" | "女"}
                birthdayType="solar"
                astrolabe={astrolabe}
                horoscope={horoscope ?? undefined}
                horoscopeDate={horoscopeDate}
                horoscopeHour={horoscopeTimeIndex <= 11 ? horoscopeTimeIndex : 0}
                onHoroscopeDateChange={handleHoroscopeDateChange}
                onHoroscopeHourChange={handleHoroscopeHourChange}
                defaultShowDecadal={true}
                defaultShowYearly={true}
                defaultShowMonthly={true}
                defaultShowDaily={true}
                defaultShowHourly={true}
              />
            </div>
          </div>
        </div>

        {/* 右侧：AI 分析 + 对话 */}
        <div className="flex w-full flex-col gap-4 md:flex-1 md:min-w-0 md:self-stretch">
          {/* 移动端分隔线 */}
          <div className="border-t md:hidden" />
          {/* 规则解析 */}
          <div className="w-full flex-none">
            {birthData ? (
              <ZiweiAnalysisPanel birthData={birthData} />
            ) : (
              <div className="p-8 text-center text-muted-foreground">
                暂无出生数据，请重新排盘
              </div>
            )}
          </div>

          {/* AI 对话区 */}
          <div className="flex-1 min-h-0">
            <ChatPanel
              astrolabeData={astrolabe}
              birthData={birthData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
