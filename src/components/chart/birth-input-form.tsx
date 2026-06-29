"use client";

import { useState, useMemo, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import {
  MAJOR_CITIES,
  TIME_PERIODS,
  calculateTrueSolarTime,
} from "@/lib/solar-time";

/**
 * 原生 <select> 组件 — 无需 JS hydration 即可交互
 * 解决通过 Cloudflare Tunnel 等慢网络下 Radix Select 需等待 JS 加载才能使用的问题
 */
function NativeSelect({
  value,
  onChange,
  children,
  className,
  disabled,
}: {
  value: string;
  onChange: (val: string) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={
        className ??
        "flex h-9 w-full rounded-md border border-primary/20 bg-background px-3 py-1 text-base shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
      }
    >
      {children}
    </select>
  );
}

interface BirthInputFormProps {
  onSubmit: (data: {
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
  }) => void;
  isLoading?: boolean;
}

const LUNAR_MONTHS = [
  "正月", "二月", "三月", "四月", "五月", "六月",
  "七月", "八月", "九月", "十月", "冬月", "腊月",
];

const LUNAR_DAYS = [
  "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十",
  "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十",
  "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十",
];

const SOLAR_MONTHS = [
  "1月", "2月", "3月", "4月", "5月", "6月",
  "7月", "8月", "9月", "10月", "11月", "12月",
];

function generateYearRange() {
  const current = new Date().getFullYear();
  const years: number[] = [];
  for (let y = current; y >= 1900; y--) {
    years.push(y);
  }
  return years;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

const thisYear = new Date().getFullYear();

// 生肖计算
const ZODIAC_ANIMALS = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
function yearToZodiac(year: number): string {
  return ZODIAC_ANIMALS[((year - 4) % 12 + 12) % 12];
}

// 父母出生年份选项（1930 到 当前年-15）
const parentYearOptions = (() => {
  const years: number[] = [];
  for (let y = thisYear - 15; y >= 1930; y--) years.push(y);
  return years;
})();

export function BirthInputForm({ onSubmit, isLoading }: BirthInputFormProps) {
  const [solarYear, setSolarYear] = useState("2000");
  const [solarMonth, setSolarMonth] = useState("1");
  const [solarDay, setSolarDay] = useState("1");

  const [lunarYear, setLunarYear] = useState("2000");
  const [lunarMonth, setLunarMonth] = useState("1");
  const [lunarDay, setLunarDay] = useState("1");
  const [isLeapMonth, setIsLeapMonth] = useState(false);

  const [birthHour, setBirthHour] = useState("10");
  const [birthMinute, setBirthMinute] = useState("0");
  const [gender, setGender] = useState("男");
  const [city, setCity] = useState("北京");
  const [showParentInfo, setShowParentInfo] = useState(false);
  const [fatherBirthYear, setFatherBirthYear] = useState("1970");
  const [motherBirthYear, setMotherBirthYear] = useState("1973");
  const [fatherZodiac, setFatherZodiac] = useState(() => yearToZodiac(1970)); // 狗
  const [motherZodiac, setMotherZodiac] = useState(() => yearToZodiac(1973)); // 牛
  const [isLunar, setIsLunar] = useState(false);
  // S-10：即时校验错误状态
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // S-10：单字段即时校验
  const validateField = (name: string): string => {
    if (name === "city") {
      return city.trim() ? "" : "请输入或选择出生城市";
    }
    if (name === "year") {
      const y = parseInt(isLunar ? lunarYear : solarYear, 10);
      if (Number.isNaN(y)) return "年份无效";
      if (y < 1900 || y > thisYear) return `年份应在 1900-${thisYear} 之间`;
      return "";
    }
    if (name === "day") {
      const y = parseInt(solarYear, 10);
      const m = parseInt(solarMonth, 10);
      const d = parseInt(solarDay, 10);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
        const max = getDaysInMonth(y, m);
        if (d < 1 || d > max) return `日期应为 1-${max} 之间`;
      }
      return "";
    }
    return "";
  };

  const handleBlur = (name: string) => {
    const err = validateField(name);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (err) next[name] = err;
      else delete next[name];
      return next;
    });
  };

  // 年份变化时自动重置生肖为当年生肖
  const handleFatherYearChange = (val: string) => {
    setFatherBirthYear(val);
    setFatherZodiac(yearToZodiac(parseInt(val, 10)));
  };
  const handleMotherYearChange = (val: string) => {
    setMotherBirthYear(val);
    setMotherZodiac(yearToZodiac(parseInt(val, 10)));
  };

  // 根据选中生肖修正农历年份：选中当年生肖→阳历年=农历年；选中前一年生肖→农历年=阳历年-1
  const adjustYear = (solarYear: number, zodiac: string): number => {
    if (zodiac === yearToZodiac(solarYear)) return solarYear;
    return solarYear - 1;
  };
  const [useTrueSolar, setUseTrueSolar] = useState(true);

  const birthDateSolar = useMemo(() => {
    const y = parseInt(solarYear, 10);
    const m = parseInt(solarMonth, 10);
    let d = parseInt(solarDay, 10);
    if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) return undefined;
    const maxDay = getDaysInMonth(y, m);
    d = Math.min(Math.max(1, d), maxDay);
    const date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 ? date : undefined;
  }, [solarYear, solarMonth, solarDay]);

  const birthDate = useMemo(
    () =>
      birthDateSolar
        ? `${birthDateSolar.getFullYear()}-${String(birthDateSolar.getMonth() + 1).padStart(2, "0")}-${String(birthDateSolar.getDate()).padStart(2, "0")}`
        : "",
    [birthDateSolar]
  );

  const solarDayCount = useMemo(
    () => getDaysInMonth(parseInt(solarYear, 10) || thisYear, parseInt(solarMonth, 10) || 1),
    [solarYear, solarMonth]
  );

  useEffect(() => {
    const d = parseInt(solarDay, 10);
    if (!Number.isNaN(d) && d > solarDayCount) {
      setSolarDay(String(solarDayCount));
    }
  }, [solarDayCount, solarDay]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // S-10：提交前全字段校验，定位到第一个错误
    const errs: Record<string, string> = {};
    const cityErr = validateField("city");
    const yearErr = validateField("year");
    const dayErr = validateField("day");
    if (cityErr) errs.city = cityErr;
    if (yearErr) errs.year = yearErr;
    if (dayErr) errs.day = dayErr;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});

    if (!isLunar && !birthDateSolar) return;

    const cityInfo = MAJOR_CITIES.find((c) => c.name === city);
    let timeIndex: number;
    let trueSolarTimeInfo = "";

    if (useTrueSolar && cityInfo && !isLunar && birthDateSolar) {
      const dateObj = birthDateSolar;
      const result = calculateTrueSolarTime(
        dateObj,
        parseInt(birthHour),
        parseInt(birthMinute),
        cityInfo.longitude
      );
      timeIndex = result.timeIndex;
      trueSolarTimeInfo = `真太阳时: ${result.hour}:${String(result.minute).padStart(2, "0")} (${TIME_PERIODS[timeIndex].name} ${TIME_PERIODS[timeIndex].range})`;
    } else {
      const hour = parseInt(birthHour);
      const minute = parseInt(birthMinute);
      const totalMinutes = hour * 60 + minute;
      if (totalMinutes >= 23 * 60 || totalMinutes < 1 * 60) timeIndex = 0;
      else if (totalMinutes < 3 * 60) timeIndex = 1;
      else if (totalMinutes < 5 * 60) timeIndex = 2;
      else if (totalMinutes < 7 * 60) timeIndex = 3;
      else if (totalMinutes < 9 * 60) timeIndex = 4;
      else if (totalMinutes < 11 * 60) timeIndex = 5;
      else if (totalMinutes < 13 * 60) timeIndex = 6;
      else if (totalMinutes < 15 * 60) timeIndex = 7;
      else if (totalMinutes < 17 * 60) timeIndex = 8;
      else if (totalMinutes < 19 * 60) timeIndex = 9;
      else if (totalMinutes < 21 * 60) timeIndex = 10;
      else if (totalMinutes < 23 * 60) timeIndex = 11;
      else timeIndex = 12;

      if (isLunar) {
        trueSolarTimeInfo = `农历 ${lunarYear}年${LUNAR_MONTHS[parseInt(lunarMonth) - 1]}${LUNAR_DAYS[parseInt(lunarDay) - 1]} (${TIME_PERIODS[timeIndex].name})`;
      } else {
        trueSolarTimeInfo = `北京时间: ${birthHour}:${String(parseInt(birthMinute)).padStart(2, "0")} (${TIME_PERIODS[timeIndex].name})`;
      }
    }

    if (isLunar) {
      const lunarDateStr = `${lunarYear}-${lunarMonth}-${lunarDay}`;
      onSubmit({
        solarDate: "",
        lunarDate: lunarDateStr,
        timeIndex,
        gender,
        isLunar: true,
        isLeapMonth,
        city,
        trueSolarTimeInfo,
        parentBirthYears: showParentInfo ? {
          father: adjustYear(parseInt(fatherBirthYear, 10), fatherZodiac),
          mother: adjustYear(parseInt(motherBirthYear, 10), motherZodiac),
        } : undefined,
        parentZodiacs: showParentInfo ? {
          father: fatherZodiac,
          mother: motherZodiac,
        } : undefined,
      });
    } else {
      onSubmit({
        solarDate: birthDate,
        timeIndex,
        gender,
        isLunar: false,
        city,
        trueSolarTimeInfo,
        parentBirthYears: showParentInfo ? {
          father: adjustYear(parseInt(fatherBirthYear, 10), fatherZodiac),
          mother: adjustYear(parseInt(motherBirthYear, 10), motherZodiac),
        } : undefined,
        parentZodiacs: showParentInfo ? {
          father: fatherZodiac,
          mother: motherZodiac,
        } : undefined,
      });
    }
  };

  const yearOptions = generateYearRange();

  return (
    <form onSubmit={handleSubmit}>
      <div className="field flex items-center justify-between" style={{ marginBottom: 14 }}>
        <label className="field-label" style={{ marginBottom: 0 }}>使用阴历（农历）</label>
        <Switch checked={isLunar} onCheckedChange={setIsLunar} />
      </div>

      {isLunar ? (
        <div className="field">
          <label className="field-label">农历出生日期</label>
          <div className="field-row-3">
            <NativeSelect value={lunarYear} onChange={setLunarYear}>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}年
                </option>
              ))}
            </NativeSelect>

            <NativeSelect value={lunarMonth} onChange={setLunarMonth}>
              {LUNAR_MONTHS.map((name, i) => (
                <option key={i} value={String(i + 1)}>
                  {name}
                </option>
              ))}
            </NativeSelect>

            <NativeSelect value={lunarDay} onChange={setLunarDay}>
              {LUNAR_DAYS.map((name, i) => (
                <option key={i} value={String(i + 1)}>
                  {name}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex items-center gap-2" style={{ marginTop: 8 }}>
            <Switch checked={isLeapMonth} onCheckedChange={setIsLeapMonth} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>闰月</span>
          </div>
        </div>
      ) : (
        <div className="field">
          <label className="field-label">出生日期（阳历）</label>
          <div className="field-row-3">
            <NativeSelect value={solarYear} onChange={setSolarYear}>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}年
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={solarMonth} onChange={setSolarMonth}>
              {SOLAR_MONTHS.map((name, i) => (
                <option key={i} value={String(i + 1)}>
                  {name}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={solarDay} onChange={setSolarDay}>
              {Array.from({ length: solarDayCount }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {d}日
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
      )}

      <div className="field-row">
        <div className="field">
          <label className="field-label">时 (0-23)</label>
          <input
            type="number"
            min={0}
            max={23}
            value={birthHour}
            onChange={(e) => setBirthHour(e.target.value)}
            className="input"
          />
        </div>
        <div className="field">
          <label className="field-label">分 (0-59)</label>
          <input
            type="number"
            min={0}
            max={59}
            value={birthMinute}
            onChange={(e) => setBirthMinute(e.target.value)}
            className="input"
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label">性别</label>
        <NativeSelect value={gender} onChange={setGender}>
          <option value="男">男</option>
          <option value="女">女</option>
        </NativeSelect>
      </div>

      {/* 父母出生年份（可选） */}
      <div className="field" style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12 }}>
        <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
          <label
            className="field-label"
            style={{ marginBottom: 0, fontSize: 12, cursor: "help" }}
            title="用于四化评分修正：父母生年天干决定父母宫化禄/化忌落点，影响家庭缘、长辈助力评分。留空则跳过此维度，不影响主盘排布。"
          >
            父母出生年份（可选）
          </label>
          <Switch checked={showParentInfo} onCheckedChange={setShowParentInfo} />
        </div>
        {showParentInfo && (
          <>
            <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "4px 0 10px" }}>
              输入父母的生年生肖，会提升准确率。请根据实际生肖点选。
            </p>
            <div className="field-row">
              {/* 父亲 */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ fontSize: 12, color: "var(--text-muted)" }}>父亲</label>
                <NativeSelect value={fatherBirthYear} onChange={handleFatherYearChange}>
                  {parentYearOptions.map((y) => (
                    <option key={y} value={String(y)}>{y}年</option>
                  ))}
                </NativeSelect>
                <div className="flex gap-1" style={{ marginTop: 6 }}>
                  {(() => {
                    const fy = parseInt(fatherBirthYear, 10);
                    const cur = yearToZodiac(fy);
                    const prev = yearToZodiac(fy - 1);
                    return [cur, prev].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setFatherZodiac(z)}
                        className="chip"
                        style={
                          fatherZodiac === z
                            ? { padding: "2px 10px", fontSize: 11, background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }
                            : { padding: "2px 10px", fontSize: 11 }
                        }
                      >
                        {z}
                      </button>
                    ));
                  })()}
                </div>
              </div>
              {/* 母亲 */}
              <div className="field" style={{ marginBottom: 0 }}>
                <label className="field-label" style={{ fontSize: 12, color: "var(--text-muted)" }}>母亲</label>
                <NativeSelect value={motherBirthYear} onChange={handleMotherYearChange}>
                  {parentYearOptions.map((y) => (
                    <option key={y} value={String(y)}>{y}年</option>
                  ))}
                </NativeSelect>
                <div className="flex gap-1" style={{ marginTop: 6 }}>
                  {(() => {
                    const my = parseInt(motherBirthYear, 10);
                    const cur = yearToZodiac(my);
                    const prev = yearToZodiac(my - 1);
                    return [cur, prev].map((z) => (
                      <button
                        key={z}
                        type="button"
                        onClick={() => setMotherZodiac(z)}
                        className="chip"
                        style={
                          motherZodiac === z
                            ? { padding: "2px 10px", fontSize: 11, background: "var(--brand)", color: "#fff", borderColor: "var(--brand)" }
                            : { padding: "2px 10px", fontSize: 11 }
                        }
                      >
                        {z}
                      </button>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!isLunar && (
        <div className="field">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <label className="field-label" style={{ marginBottom: 0 }}>
              <span className="sm:hidden">出生城市</span>
              <span className="hidden sm:inline">出生城市（用于真太阳时校正）</span>
            </label>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>启用真太阳时</span>
              <Switch
                checked={useTrueSolar}
                onCheckedChange={setUseTrueSolar}
              />
            </div>
          </div>
          <NativeSelect
            value={city}
            onChange={setCity}
            disabled={!useTrueSolar}
          >
            {MAJOR_CITIES.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} (经度 {c.longitude}°E)
              </option>
            ))}
          </NativeSelect>
        </div>
      )}

      {/* S-10：即时校验错误提示 */}
      {Object.keys(fieldErrors).length > 0 && (
        <div
          className="help-note"
          style={{
            marginBottom: 12,
            borderColor: "var(--danger)",
            color: "var(--danger)",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 4,
          }}
          role="alert"
        >
          {Object.entries(fieldErrors).map(([k, v]) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i className="ti ti-alert-circle" />
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        style={{ width: "100%", fontSize: 16, marginTop: 6 }}
        disabled={(!isLunar && !birthDateSolar) || isLoading}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <i className="ti ti-loader-2 ti-spin" />
            正在生成命盘...
          </span>
        ) : (
          "生成命盘"
        )}
      </button>
    </form>
  );
}
