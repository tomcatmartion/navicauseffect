"use client";

import { useEffect, useState } from "react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStat } from "@/components/admin/AdminStat";
import { AdminStatGrid } from "@/components/admin/AdminStatGrid";

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

  const cards = [
    { label: "总用户数", icon: "ti-users", value: stats?.totalUsers },
    { label: "今日新增", icon: "ti-trending-up", value: stats?.todayNewUsers },
    { label: "付费会员", icon: "ti-crown", value: stats?.premiumUsers },
    { label: "今日收入", icon: "ti-cash", value: stats?.todayRevenue, prefix: "¥" },
    { label: "今日排盘", icon: "ti-yin-yang", value: stats?.todayCharts },
    { label: "AI 调用次数", icon: "ti-robot", value: stats?.todayAnalyses },
  ];

  return (
    <>
      <AdminPageHeader
        icon="ti-dashboard"
        title="仪表盘"
        desc="平台运营数据总览"
      />

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}（请确认已以管理员身份登录）</span>
        </div>
      )}

      <AdminStatGrid>
        {cards.map((card) => (
          <AdminStat
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={
              card.value === undefined
                ? "..."
                : card.prefix
                ? `${card.prefix}${card.value}`
                : card.value
            }
          />
        ))}
      </AdminStatGrid>
    </>
  );
}
