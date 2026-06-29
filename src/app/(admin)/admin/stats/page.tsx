"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStat } from "@/components/admin/AdminStat";
import { AdminStatGrid } from "@/components/admin/AdminStatGrid";

interface UserStats {
  todayNew: number;
  weekActive: number;
  monthActive: number;
  totalUsers: number;
  trend: Array<{ date: string; count: number }>;
}

interface RevenueStats {
  todayRevenue: number;
  monthRevenue: number;
  wechatRevenue: number;
  alipayRevenue: number;
  trend: Array<{ date: string; amount: number }>;
}

interface UsageStats {
  categories: Array<{ category: string; count: number }>;
  totalCharts: number;
}

interface BehaviorStats {
  funnel: Array<{ step: string; count: number }>;
}

const CATEGORY_LABELS: Record<string, string> = {
  PERSONALITY: "性格分析",
  FORTUNE: "总体运势",
  MARRIAGE: "感情婚姻",
  CAREER: "事业财运",
  HEALTH: "身体健康",
  PARENT_CHILD: "亲子关系",
  EMOTION: "情绪疏导",
};

export default function StatsPage() {
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [revenueStats, setRevenueStats] = useState<RevenueStats | null>(null);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [behaviorStats, setBehaviorStats] = useState<BehaviorStats | null>(null);
  const [error, setError] = useState("");

  const fetchSection = async (section: string) => {
    try {
      const res = await fetch(`/api/admin/stats?section=${section}`);
      if (!res.ok) throw new Error("加载失败");
      return await res.json();
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
      return null;
    }
  };

  const handleTabChange = async (tab: string) => {
    if (tab === "users" && !userStats) {
      setUserStats(await fetchSection("users"));
    } else if (tab === "revenue" && !revenueStats) {
      setRevenueStats(await fetchSection("revenue"));
    } else if (tab === "usage" && !usageStats) {
      setUsageStats(await fetchSection("usage"));
    } else if (tab === "behavior" && !behaviorStats) {
      setBehaviorStats(await fetchSection("behavior"));
    }
  };

  useEffect(() => {
    handleTabChange("users");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <AdminPageHeader
        icon="ti-chart-line"
        title="数据统计"
        desc="用户、收入、功能使用与行为漏斗分析"
      />

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      <Tabs defaultValue="users" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="users">用户统计</TabsTrigger>
          <TabsTrigger value="revenue">收入统计</TabsTrigger>
          <TabsTrigger value="usage">功能使用</TabsTrigger>
          <TabsTrigger value="behavior">用户行为</TabsTrigger>
        </TabsList>

        <TabsContent value="users" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <AdminStatGrid>
            <AdminStat icon="ti-user-plus" label="日新增用户" value={userStats?.todayNew ?? "..."} />
            <AdminStat icon="ti-calendar-week" label="周活跃用户" value={userStats?.weekActive ?? "..."} />
            <AdminStat icon="ti-calendar-month" label="月活跃用户" value={userStats?.monthActive ?? "..."} />
            <AdminStat icon="ti-users" label="总用户数" value={userStats?.totalUsers ?? "..."} />
          </AdminStatGrid>
          {userStats?.trend && userStats.trend.length > 0 && (
            <AdminCard icon="ti-chart-bar" title="近 7 日新增用户">
              <TrendBars
                data={userStats.trend.map((d) => ({ label: d.date.slice(5), value: d.count }))}
                color="var(--brand)"
              />
            </AdminCard>
          )}
        </TabsContent>

        <TabsContent value="revenue" style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
          <AdminStatGrid>
            <AdminStat icon="ti-cash" label="今日收入" value={revenueStats ? `¥${revenueStats.todayRevenue}` : "..."} />
            <AdminStat icon="ti-calendar-stats" label="月度收入" value={revenueStats ? `¥${revenueStats.monthRevenue}` : "..."} />
            <AdminStat icon="ti-brand-wechat" label="微信支付" value={revenueStats ? `¥${revenueStats.wechatRevenue}` : "..."} />
            <AdminStat icon="ti-credit-card" label="支付宝" value={revenueStats ? `¥${revenueStats.alipayRevenue}` : "..."} />
          </AdminStatGrid>
          {revenueStats?.trend && revenueStats.trend.length > 0 && (
            <AdminCard icon="ti-chart-bar" title="近 7 日收入趋势">
              <TrendBars
                data={revenueStats.trend.map((d) => ({ label: d.date.slice(5), value: d.amount, prefix: "¥" }))}
                color="var(--success)"
              />
            </AdminCard>
          )}
        </TabsContent>

        <TabsContent value="usage" style={{ marginTop: 16 }}>
          <AdminStatGrid>
            {usageStats?.categories.map((cat) => (
              <AdminStat
                key={cat.category}
                icon="ti-chart-dots"
                label={CATEGORY_LABELS[cat.category] || cat.category}
                value={cat.count}
              />
            ))}
            <AdminStat icon="ti-yin-yang" label="排盘总数" value={usageStats?.totalCharts ?? "..."} />
          </AdminStatGrid>
        </TabsContent>

        <TabsContent value="behavior" style={{ marginTop: 16 }}>
          <AdminCard icon="ti-filter" title="用户行为漏斗">
            {behaviorStats?.funnel && behaviorStats.funnel.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {behaviorStats.funnel.map((step, i) => {
                  const maxCount = behaviorStats.funnel[0]?.count || 1;
                  const rate =
                    i === 0 ? "100%" : `${((step.count / maxCount) * 100).toFixed(1)}%`;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between" style={{ fontSize: 13, marginBottom: 6 }}>
                        <span style={{ color: "var(--ink)" }}>{step.step}</span>
                        <div className="flex items-center" style={{ gap: 16 }}>
                          <span style={{ fontWeight: 600, fontFamily: "var(--font-mono)" }}>{step.count}</span>
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--text-muted)",
                              width: 48,
                              textAlign: "right",
                              fontFamily: "var(--font-mono)",
                            }}
                          >
                            {rate}
                          </span>
                        </div>
                      </div>
                      <div style={{ height: 8, background: "var(--soft)", borderRadius: 4, overflow: "hidden" }}>
                        <div
                          style={{
                            height: "100%",
                            borderRadius: 4,
                            background: "linear-gradient(90deg, var(--brand), var(--brand-light))",
                            width: `${(step.count / maxCount) * 100}%`,
                            minWidth: step.count > 0 ? 8 : 0,
                            transition: "width .4s ease",
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: 24, color: "var(--text-muted)" }}>
                加载中...
              </div>
            )}
          </AdminCard>
        </TabsContent>
      </Tabs>
    </>
  );
}

/** 趋势柱状图（极简，无外部图表库） */
function TrendBars({
  data,
  color,
}: {
  data: Array<{ label: string; value: number; prefix?: string }>;
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 160 }}>
      {data.map((d) => (
        <div
          key={d.label}
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 4,
          }}
        >
          <div
            style={{
              width: "100%",
              borderTopLeftRadius: 4,
              borderTopRightRadius: 4,
              background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 60%, transparent))`,
              height: `${(d.value / max) * 100}%`,
              minHeight: 4,
              transition: "height .4s ease",
            }}
          />
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{d.label}</span>
          <span style={{ fontSize: 12, fontWeight: 600, fontFamily: "var(--font-mono)", color: "var(--ink)" }}>
            {d.prefix || ""}
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
