"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface OverviewStats {
  totalUsers: number;
  todayNewUsers: number;
  premiumUsers: number;
  todayRevenue: number;
  todayCharts: number;
  todayAnalyses: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<OverviewStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/admin/stats?section=overview")
      .then((res) => {
        if (!res.ok) throw new Error("无权限或请求失败");
        return res.json();
      })
      .then(setStats)
      .catch((err) => setError(err.message));
  }, []);

  const cards = stats
    ? [
        { label: "总用户数", value: String(stats.totalUsers), icon: "ti-users" },
        { label: "今日新增", value: String(stats.todayNewUsers), icon: "ti-trending-up" },
        { label: "付费会员", value: String(stats.premiumUsers), icon: "ti-crown" },
        { label: "今日收入", value: `¥${stats.todayRevenue}`, icon: "ti-cash" },
        { label: "今日排盘", value: String(stats.todayCharts), icon: "ti-yin-yang" },
        { label: "AI 调用次数", value: String(stats.todayAnalyses), icon: "ti-robot" },
      ]
    : [
        { label: "总用户数", value: "...", icon: "ti-users" },
        { label: "今日新增", value: "...", icon: "ti-trending-up" },
        { label: "付费会员", value: "...", icon: "ti-crown" },
        { label: "今日收入", value: "...", icon: "ti-cash" },
        { label: "今日排盘", value: "...", icon: "ti-yin-yang" },
        { label: "AI 调用次数", value: "...", icon: "ti-robot" },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <i className="ti ti-dashboard text-xl" style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold">仪表盘</h2>
          <p className="text-xs text-muted-foreground mt-0.5">平台运营数据总览</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {error}（请确认已以管理员身份登录）
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        {cards.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <div className="flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "var(--soft)" }}>
                <i className={`ti ${stat.icon}`} style={{ fontSize: 18, color: "var(--brand)" }} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
