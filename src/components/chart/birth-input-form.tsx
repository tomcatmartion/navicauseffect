"use client";

import { useState, useMemo, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
        "flex h-9 w-full rounded-md border border-primary/20 bg-background px-3 py-1 text-sm shadow-xs transition-colors focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
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

export function BirthInputForm({ onSubmit, isLoading }: BirthInputFormProps) {
  const [solarYear, setSolarYear] = useState("1982");
  const [solarMonth, setSolarMonth] = useState("9");
  const [solarDay, setSolarDay] = useState("24");

  const [lunarYear, setLunarYear] = useState("1982");
  const [lunarMonth, setLunarMonth] = useState("1");
  const [lunarDay, setLunarDay] = useState("1");
  const [isLeapMonth, setIsLeapMonth] = useState(false);

  const [birthHour, setBirthHour] = useState("4");
  const [birthMinute, setBirthMinute] = useState("0");
  const [gender, setGender] = useState("男");
  const [city, setCity] = useState("北京");
  const [isLunar, setIsLunar] = useState(false);
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
      });
    } else {
      onSubmit({
        solarDate: birthDate,
        timeIndex,
        gender,
        isLunar: false,
        city,
        trueSolarTimeInfo,
      });
    }
  };

  const yearOptions = generateYearRange();

  return (
    <Card className="border-primary/15">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 font-[var(--font-serif-sc)] text-xl text-primary">
          <span className="text-2xl">☯</span>
          输入出生信息
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex items-center justify-between">
            <Label>使用阴历（农历）</Label>
            <Switch checked={isLunar} onCheckedChange={setIsLunar} />
          </div>

          {isLunar ? (
            <div className="space-y-3">
              <Label>农历出生日期</Label>
              <div className="grid grid-cols-3 gap-2">
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
              <div className="flex items-center gap-2">
                <Switch checked={isLeapMonth} onCheckedChange={setIsLeapMonth} />
                <Label className="text-xs text-muted-foreground">闰月</Label>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label>出生日期（阳历）</Label>
              <div className="grid grid-cols-3 gap-2">
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>时 (0-23)</Label>
              <Input
                type="number"
                min="0"
                max="23"
                value={birthHour}
                onChange={(e) => setBirthHour(e.target.value)}
                className="border-primary/20 focus:border-primary"
              />
            </div>
            <div className="space-y-2">
              <Label>分 (0-59)</Label>
              <Input
                type="number"
                min="0"
                max="59"
                value={birthMinute}
                onChange={(e) => setBirthMinute(e.target.value)}
                className="border-primary/20 focus:border-primary"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>性别</Label>
            <NativeSelect value={gender} onChange={setGender}>
              <option value="男">男</option>
              <option value="女">女</option>
            </NativeSelect>
          </div>

          {!isLunar && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>出生城市（用于真太阳时校正）</Label>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">启用真太阳时</Label>
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

          <Button
            type="submit"
            className="w-full bg-primary text-lg hover:bg-primary/90"
            disabled={(!isLunar && !birthDateSolar) || isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                正在生成命盘...
              </span>
            ) : (
              "生成命盘"
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
