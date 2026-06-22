"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { IFunctionalAstrolabe } from "iztro/lib/astro/FunctionalAstrolabe";
import type { IFunctionalHoroscope } from "iztro/lib/astro/FunctionalHoroscope";
import { BirthInputForm } from "@/components/chart/birth-input-form";
import { SaveChartButton } from "@/components/chart/save-chart-button";
import { serializeAstrolabeForReading } from "@/lib/ziwei/serialize-chart-for-reading";

// 重型依赖：排盘后才需要，用 dynamic import 按需加载
const Iztrolabe = dynamic(
  () =>
    import("react-iztro").then((mod) => {
      /* eslint-disable @typescript-eslint/no-require-imports -- 动态 chunk 内需同步 require CSS，避免首帧无样式 */
      require("react-iztro/lib/theme/default.css");
      require("react-iztro/lib/Iztrolabe/Iztrolabe.css");
      require("react-iztro/lib/IzpalaceCenter/IzpalaceCenter.css");
      require("react-iztro/lib/Izpalace/Izpalace.css");
      /* eslint-enable @typescript-eslint/no-require-imports */
      return mod.Iztrolabe as unknown as React.ComponentType<Record<string, unknown>>;
    }),
  { ssr: false }
);

const ZiweiAnalysisPanel = dynamic(
  () => import("@/components/analysis/ziwei-analysis-panel").then((m) => m.ZiweiAnalysisPanel),
  { ssr: false }
);

const DualChatPanel = dynamic(
  () => import("@/components/analysis/dual-chat-panel").then((m) => m.DualChatPanel),
  { ssr: false }
);

const CHART_STATE_KEY = "chart_birth_state";
const CHART_RENDER_WIDTH = 600;
const CHART_PADDING = 16;

async function getAstro() {
  const { astro } = await import("iztro");
  return astro;
}

function preloadHeavyDeps() {
  import("iztro");
  import("react-iztro");
  import("@/components/analysis/ziwei-analysis-panel");
  import("@/components/analysis/dual-chat-panel");
}

interface BirthData {
  gender: "MALE" | "FEMALE";
  year: number;
  month: number;
  day: number;
  hour: number;
  solar?: boolean;
  birthCity?: string;
}

export default function ChartPage() {
  const [astrolabe, setAstrolabe] = useState<IFunctionalAstrolabe | null>(null);
  const [horoscope, setHoroscope] = useState<IFunctionalHoroscope | null>(null);
  const [trueSolarTimeInfo, setTrueSolarTimeInfo] = useState("");
  const [birthTimeIndex, setBirthTimeIndex] = useState(0);
  const [horoscopeTimeIndex, setHoroscopeTimeIndex] = useState(0);
  const [birthData, setBirthData] = useState<BirthData | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [parentBirthYears, setParentBirthYears] = useState<{ father?: number; mother?: number } | undefined>();
  const [restoredChartData, setRestoredChartData] = useState<Record<string, unknown> | null>(null);
  const [chartPanelOpen, setChartPanelOpen] = useState(true);

  const chartDataForPipeline = useMemo(() => {
    if (restoredChartData) return restoredChartData;
    if (!astrolabe || !birthData) return null;
    const referenceYear = horoscope?.yearly?.index ?? new Date().getFullYear();
    return serializeAstrolabeForReading(
      astrolabe as unknown as Record<string, unknown>,
      {
        year: birthData.year,
        month: birthData.month,
        day: birthData.day,
        hour: birthData.hour,
        gender: birthData.gender === "MALE" ? "男" : "女",
        solar: birthData.solar,
        birthCity: birthData.birthCity,
      },
      horoscope
        ? { horoscope: horoscope as unknown as Record<string, unknown>, referenceYear }
        : undefined,
    ) as Record<string, unknown>;
  }, [restoredChartData, astrolabe, birthData, horoscope]);

  // 命盘缩放
  const chartWrapperRef = useRef<HTMLDivElement>(null);
  const chartInnerRef = useRef<HTMLDivElement>(null);
  const [chartScale, setChartScale] = useState(1);
  const [chartNaturalHeight, setChartNaturalHeight] = useState(0);

  useEffect(() => {
    const wrapper = chartWrapperRef.current;
    if (!wrapper) return;
    const update = () => {
      const availableWidth = wrapper.clientWidth - CHART_PADDING * 2;
      setChartScale(Math.min(availableWidth / CHART_RENDER_WIDTH, 1));
      if (chartInnerRef.current) {
        setChartNaturalHeight(chartInnerRef.current.scrollHeight);
      }
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, [astrolabe, chartPanelOpen]);

  useEffect(() => {
    preloadHeavyDeps();
  }, []);

  // 恢复 sessionStorage
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
          const horo = result.horoscope(new Date(), saved.hour);
          setHoroscope(horo);
          setTrueSolarTimeInfo(saved.trueSolarTimeInfo ?? "");
        }
        setParentBirthYears(saved.parentBirthYears);
      } catch {
        // 忽略
      }
    })();
  }, []);

  // 处理 ?chartRecordId=xxx
  const searchParams = useSearchParams();
  useEffect(() => {
    const chartRecordId = searchParams.get("chartRecordId");
    if (!chartRecordId || astrolabe) return;
    (async () => {
      try {
        const res = await fetch(`/api/charts/${chartRecordId}`);
        if (!res.ok) return;
        const data = await res.json();
        const snap = data.chart?.chartSnapshot;
        if (!snap?.birthInfo) return;
        const bi = snap.birthInfo;
        const astro = await getAstro();
        const dateStr = `${bi.year}-${String(bi.month).padStart(2, "0")}-${String(bi.day).padStart(2, "0")}`;
        const result = astro.bySolar(
          dateStr,
          bi.hour,
          bi.gender === "MALE" ? "男" : "女",
          true,
          "zh-CN",
        );
        setAstrolabe(result);
        if (snap.reading && typeof snap.reading === "object") {
          setRestoredChartData(snap.reading as Record<string, unknown>);
        }
        const restoredBirth: BirthData = {
          gender: bi.gender,
          year: bi.year,
          month: bi.month,
          day: bi.day,
          hour: bi.hour,
          solar: bi.solar,
          birthCity: data.chart?.birthCity ?? undefined,
        };
        setBirthData(restoredBirth);
        setBirthTimeIndex(bi.hour);
        setHoroscopeTimeIndex(bi.hour);
        const horo = result.horoscope(new Date(), bi.hour);
        setHoroscope(horo);
        setTrueSolarTimeInfo(bi.trueSolarTimeInfo ?? "");
        sessionStorage.setItem(
          CHART_STATE_KEY,
          JSON.stringify({
            ...restoredBirth,
            trueSolarTimeInfo: bi.trueSolarTimeInfo ?? "",
          }),
        );
      } catch {
        // 静默失败
      }
    })();
  }, [searchParams, astrolabe]);

  const handleGenerateChart = async (data: {
    solarDate: string;
    lunarDate?: string;
    timeIndex: number;
    gender: string;
    isLunar: boolean;
    isLeapMonth?: boolean;
    city: string;
    trueSolarTimeInfo: string;
    parentBirthYears?: { father?: number; mother?: number };
    parentZodiacs?: { father?: string; mother?: string };
  }) => {
    setRestoredChartData(null);
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
      const birthInfo: BirthData = {
        gender: (data.gender === "男" ? "MALE" : "FEMALE"),
        year: dateMatch ? parseInt(dateMatch[1], 10) : new Date().getFullYear(),
        month: dateMatch ? parseInt(dateMatch[2], 10) : 1,
        day: dateMatch ? parseInt(dateMatch[3], 10) : 1,
        hour: data.timeIndex,
        solar: !data.isLunar,
        birthCity: data.city,
      };

      setBirthData(birthInfo);
      setParentBirthYears(data.parentBirthYears);
      setAstrolabe(result);
      setTrueSolarTimeInfo(data.trueSolarTimeInfo);
      setBirthTimeIndex(data.timeIndex);
      setHoroscopeTimeIndex(data.timeIndex);
      const horo = result.horoscope(new Date(), data.timeIndex);
      setHoroscope(horo);

      sessionStorage.setItem(CHART_STATE_KEY, JSON.stringify({
        ...birthInfo,
        trueSolarTimeInfo: data.trueSolarTimeInfo,
        parentBirthYears: data.parentBirthYears,
        parentZodiacs: data.parentZodiacs,
      }));
    } catch (err) {
      console.error("排盘错误:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleHoroscopeHourChange = (hour: number) => {
    const clampedHour = Math.max(0, Math.min(12, hour));
    setHoroscopeTimeIndex(clampedHour);
    if (astrolabe) {
      const newHoroscope = astrolabe.horoscope(new Date(), clampedHour);
      setHoroscope(newHoroscope);
    }
  };

  const handleReenter = () => {
    setAstrolabe(null);
    setHoroscope(null);
    setTrueSolarTimeInfo("");
    setBirthData(null);
    setRestoredChartData(null);
    sessionStorage.removeItem(CHART_STATE_KEY);
  };

  const toggleChartPanel = useCallback(() => {
    setChartPanelOpen((v) => !v);
  }, []);

  // ── 新建态：出生信息表单 ─────────────────────────────────
  if (!astrolabe) {
    return (
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 24px 60px" }}>
        {/* 步骤条 */}
        <div className="step-bar">
          <div className="step active">
            <div className="dot">1</div> 出生信息
          </div>
          <div className="step-line" />
          <div className="step">
            <div className="dot">2</div> 排盘确认
          </div>
          <div className="step-line" />
          <div className="step">
            <div className="dot">3</div> AI 对话
          </div>
        </div>

        {/* 提示 */}
        <div className="help-note" style={{ marginBottom: 20 }}>
          <b>首次排盘免费。</b>排盘后可永久保存到「<Link href="/charts" style={{ color: "var(--brand)" }}>我的命盘</Link>」,后续 AI 解盘与报告生成会消耗星币。
        </div>

        {/* 表单卡（BirthInputForm 内部已是完整 shadcn 表单，外层用 testUI card 视觉容器） */}
        <div className="card" style={{ padding: 24 }}>
          <div className="card-title" style={{ marginBottom: 4 }}>
            <i className="ti ti-user" /> 命主基本信息
          </div>
          <div className="card-sub" style={{ marginBottom: 18 }}>
            标 * 为必填,其余可留空,但越完整解盘越精准
          </div>
          <BirthInputForm onSubmit={handleGenerateChart} isLoading={isGenerating} />
        </div>
      </div>
    );
  }

  // ── 对话态：三栏 reading-layout + 命盘抽屉 ─────────────────
  return (
    <>
      {/* 三栏布局 */}
      <div className="reading-layout" style={{ padding: "14px 18px", maxWidth: "100%" }}>
        {/* 左栏：历史会话 + 模型选择 */}
        <aside className="reading-sidebar">
          <h4>历史会话</h4>
          <div className="model-bar">
            <i className="ti ti-cpu" />
            <select aria-label="AI 模型选择" defaultValue="minimax">
              <option value="minimax">MiniMax v1</option>
              <option value="deepseek">DeepSeek V3</option>
              <option value="glm">智谱 GLM-4</option>
              <option value="qwen">通义千问 Max</option>
              <option value="claude">Claude Sonnet</option>
            </select>
          </div>
          <div className="consult-list">
            <div className="consult-item" style={{ background: "var(--soft)" }}>
              <i className="ti ti-briefcase" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="ctitle">当前咨询</div>
                <div className="cmeta">{trueSolarTimeInfo || "新会话"}</div>
              </div>
            </div>
            <Link href="/charts" className="consult-item">
              <i className="ti ti-clipboard-list" style={{ color: "var(--brand)" }} />
              <div style={{ flex: 1 }}>
                <div className="ctitle" style={{ color: "var(--brand)" }}>从命盘继续</div>
                <div className="cmeta">选择已保存命盘</div>
              </div>
            </Link>
          </div>
        </aside>

        {/* 中栏：Chat 主区（DualChatPanel 自包含 .chat-shell） */}
        <section className="reading-main">
          <DualChatPanel
            chartData={chartDataForPipeline}
            parentBirthYears={parentBirthYears}
          />
        </section>
      </div>

      {/* 命盘抽屉（绝对定位右侧） */}
      <div
        className={`backdrop${chartPanelOpen ? "" : " hide"}`}
        onClick={toggleChartPanel}
        aria-hidden={!chartPanelOpen}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.18)",
          opacity: chartPanelOpen ? 0.6 : 0,
          pointerEvents: chartPanelOpen ? "auto" : "none",
          transition: "opacity .3s",
          zIndex: 15,
        }}
      />
      <aside className={`chart-panel${chartPanelOpen ? " open" : ""}`} aria-label="命盘抽屉">
        <div className="chart-panel-head">
          <div className="chart-panel-title">
            <i className="ti ti-clipboard-list" style={{ marginRight: 6 }} />
            {birthData ? "当前命盘" : "命盘"}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="iconbtn"
              onClick={handleReenter}
              title="重新排盘"
              aria-label="重新排盘"
            >
              <i className="ti ti-refresh" />
            </button>
            <button
              type="button"
              className="iconbtn"
              onClick={toggleChartPanel}
              title="收起"
              aria-label="收起命盘抽屉"
            >
              <i className="ti ti-x" />
            </button>
          </div>
        </div>

        <div className="chart-panel-body">
          {/* 命盘摘要 */}
          {birthData && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                lineHeight: 1.9,
                paddingBottom: 14,
                borderBottom: "1px dashed var(--line)",
              }}
            >
              <strong style={{ color: "var(--brand)" }}>
                {birthData.gender === "MALE" ? "阳男" : "阴女"} · {birthData.year}-{birthData.month}-{birthData.day}
              </strong>
              <br />
              {trueSolarTimeInfo}
            </div>
          )}

          {/* 运限切换提示 */}
          <div className="yunlin-bar" style={{ marginTop: 14 }}>
            <button type="button" className="active">本命</button>
            <button type="button">大运</button>
            <button type="button">流年</button>
            <button type="button">流月</button>
            <button type="button">流日</button>
          </div>

          {/* iztro 命盘（react-iztro 组件） */}
          <div
            ref={chartWrapperRef}
            style={{
              marginTop: 14,
              padding: CHART_PADDING,
              background: "var(--panel)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius-sm)",
              overflow: "hidden",
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
                horoscopeHour={horoscopeTimeIndex <= 11 ? horoscopeTimeIndex : 0}
                onHoroscopeHourChange={handleHoroscopeHourChange}
                defaultShowDecadal={true}
                defaultShowYearly={true}
                defaultShowMonthly={true}
                defaultShowDaily={true}
                defaultShowHourly={true}
              />
            </div>
          </div>

          {/* 保存按钮 */}
          {birthData && (
            <div style={{ marginTop: 14, display: "flex", gap: 8 }}>
              <SaveChartButton
                visible={!!birthData}
                chartData={chartDataForPipeline}
                birthInfo={{
                  gender: birthData.gender,
                  year: birthData.year,
                  month: birthData.month,
                  day: birthData.day,
                  hour: birthData.hour,
                  solar: birthData.solar,
                  birthCity: birthData.birthCity,
                  trueSolarTimeInfo,
                }}
              />
            </div>
          )}

          {/* 规则解析（折叠区） */}
          {birthData && (
            <details style={{ marginTop: 18 }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand)",
                  padding: "8px 0",
                  borderTop: "1px solid var(--line)",
                }}
              >
                <i className="ti ti-list-details" style={{ marginRight: 6 }} />
                规则解析（能级 / 格局 / 性格）
              </summary>
              <div style={{ marginTop: 8 }}>
                <ZiweiAnalysisPanel
                  birthData={birthData}
                  chartData={chartDataForPipeline}
                  parentBirthYears={parentBirthYears}
                />
              </div>
            </details>
          )}
        </div>
      </aside>

      {/* 抽屉收起时的展开按钮（浮在右侧边缘） */}
      {!chartPanelOpen && (
        <button
          type="button"
          className="chart-toggle"
          onClick={toggleChartPanel}
          style={{
            position: "absolute",
            top: "50%",
            right: 0,
            transform: "translateY(-50%)",
            zIndex: 20,
          }}
          aria-label="显示命盘"
          title="显示命盘"
        >
          <i className="ti ti-clipboard-list" /> 显示命盘
        </button>
      )}
    </>
  );
}
