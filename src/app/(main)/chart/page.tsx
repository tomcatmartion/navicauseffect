"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import dynamic from "next/dynamic";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";
import type { IFunctionalHoroscope } from "iztro/lib/astro/FunctionalHoroscope";
import { BirthInputForm } from "@/components/chart/birth-input-form";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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

const AnalysisPanel = dynamic(
  () => import("@/components/analysis/analysis-panel").then((m) => m.AnalysisPanel),
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

  useEffect(() => {
    if (!astrolabe) return;
    const h = astrolabe.horoscope(horoscopeDate, horoscopeTimeIndex);
    setHoroscope(h);
  }, [astrolabe, horoscopeDate, horoscopeTimeIndex]);

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
      if (dateMatch) {
        setBirthData({
          gender: data.gender === "男" ? "MALE" : "FEMALE",
          year: parseInt(dateMatch[1], 10),
          month: parseInt(dateMatch[2], 10),
          day: parseInt(dateMatch[3], 10),
          hour: data.timeIndex,
          solar: !data.isLunar,
        });
      }

      setAstrolabe(result);
      setTrueSolarTimeInfo(data.trueSolarTimeInfo);
      setBirthTimeIndex(data.timeIndex);
      setHoroscopeTimeIndex(data.timeIndex);
      setHoroscopeDate(new Date());
      const horo = result.horoscope(new Date(), data.timeIndex);
      setHoroscope(horo);

      // 保存出生数据到 sessionStorage，用于从调试页返回时恢复命盘
      if (dateMatch) {
        sessionStorage.setItem(CHART_STATE_KEY, JSON.stringify({
          gender: data.gender === "男" ? "MALE" : "FEMALE",
          year: parseInt(dateMatch[1], 10),
          month: parseInt(dateMatch[2], 10),
          day: parseInt(dateMatch[3], 10),
          hour: data.timeIndex,
          solar: !data.isLunar,
          trueSolarTimeInfo: data.trueSolarTimeInfo,
        }));
      }
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
        <div>
          <h1 className="font-[var(--font-serif-sc)] text-xl font-bold text-primary md:text-2xl">
            紫微命理排盘
          </h1>
          <p className="text-xs text-muted-foreground">{trueSolarTimeInfo}</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleReenter}>
          重新排盘
        </Button>
      </div>

      {/* 主体：左右分栏 */}
      <div className="flex flex-col gap-4 md:flex-row md:gap-4">
        {/* 左侧：命盘 */}
        <div className="w-full md:w-[45%] md:flex-none">
          <div className="overflow-x-auto rounded-lg border bg-card">
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

        {/* 右侧：AI 分析 + 对话 */}
        <div className="w-full md:w-[55%] md:flex-none">
          <div className="flex h-full flex-col gap-4">
            <Tabs defaultValue="ai" className="w-full">
              <TabsList className="grid w-full max-w-xs grid-cols-2">
                <TabsTrigger value="ai">AI 智能解析</TabsTrigger>
                <TabsTrigger value="rule">规则解析</TabsTrigger>
              </TabsList>
              <TabsContent value="ai" className="mt-3">
                <AnalysisPanel
                  astrolabeData={astrolabe}
                  horoscopeData={horoscope}
                />
              </TabsContent>
              <TabsContent value="rule" className="mt-3">
                <p className="mb-2 rounded-md border border-muted bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
                  <strong className="text-foreground">规则解析</strong>
                  由站内紫微引擎本地计算，<strong className="text-foreground">不调用大模型</strong>
                </p>
                {birthData ? (
                  <ZiweiAnalysisPanel birthData={birthData} />
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    暂无出生数据，请重新排盘
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {/* AI 对话区 */}
            <ChatPanel
              astrolabeData={astrolabe}
              horoscopeData={horoscope}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
