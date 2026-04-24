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
        { label: "总用户数", value: String(stats.totalUsers), icon: "👥" },
        { label: "今日新增", value: String(stats.todayNewUsers), icon: "📈" },
        { label: "付费会员", value: String(stats.premiumUsers), icon: "👑" },
        { label: "今日收入", value: `¥${stats.todayRevenue}`, icon: "💰" },
        { label: "今日排盘", value: String(stats.todayCharts), icon: "☯" },
        { label: "AI 调用次数", value: String(stats.todayAnalyses), icon: "🤖" },
      ]
    : [
        { label: "总用户数", value: "...", icon: "👥" },
        { label: "今日新增", value: "...", icon: "📈" },
        { label: "付费会员", value: "...", icon: "👑" },
        { label: "今日收入", value: "...", icon: "💰" },
        { label: "今日排盘", value: "...", icon: "☯" },
        { label: "AI 调用次数", value: "...", icon: "🤖" },
      ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">仪表盘</h2>

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
              <span className="text-lg">{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
