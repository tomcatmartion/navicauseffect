"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">数据统计</h2>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Tabs defaultValue="users" onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="users">用户统计</TabsTrigger>
          <TabsTrigger value="revenue">收入统计</TabsTrigger>
          <TabsTrigger value="usage">功能使用</TabsTrigger>
          <TabsTrigger value="behavior">用户行为</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="日新增用户" value={userStats?.todayNew ?? "..."} />
            <StatCard label="周活跃用户" value={userStats?.weekActive ?? "..."} />
            <StatCard label="月活跃用户" value={userStats?.monthActive ?? "..."} />
            <StatCard label="总用户数" value={userStats?.totalUsers ?? "..."} />
          </div>
          {userStats?.trend && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">近 7 日新增用户</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-40 items-end gap-2">
                  {userStats.trend.map((d) => {
                    const max = Math.max(...userStats.trend.map((t) => t.count), 1);
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-primary/70 transition-all"
                          style={{ height: `${(d.count / max) * 100}%`, minHeight: 4 }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {d.date.slice(5)}
                        </span>
                        <span className="text-xs font-semibold">{d.count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label="今日收入" value={revenueStats ? `¥${revenueStats.todayRevenue}` : "..."} />
            <StatCard label="月度收入" value={revenueStats ? `¥${revenueStats.monthRevenue}` : "..."} />
            <StatCard label="微信支付" value={revenueStats ? `¥${revenueStats.wechatRevenue}` : "..."} />
            <StatCard label="支付宝" value={revenueStats ? `¥${revenueStats.alipayRevenue}` : "..."} />
          </div>
          {revenueStats?.trend && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">近 7 日收入趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex h-40 items-end gap-2">
                  {revenueStats.trend.map((d) => {
                    const max = Math.max(...revenueStats.trend.map((t) => t.amount), 1);
                    return (
                      <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-emerald-500/70 transition-all"
                          style={{ height: `${(d.amount / max) * 100}%`, minHeight: 4 }}
                        />
                        <span className="text-[10px] text-muted-foreground">
                          {d.date.slice(5)}
                        </span>
                        <span className="text-xs font-semibold">¥{d.amount}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="usage" className="space-y-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {usageStats?.categories.map((cat) => (
              <StatCard
                key={cat.category}
                label={CATEGORY_LABELS[cat.category] || cat.category}
                value={cat.count}
              />
            ))}
            <StatCard label="排盘总数" value={usageStats?.totalCharts ?? "..."} />
          </div>
        </TabsContent>

        <TabsContent value="behavior" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">用户行为漏斗</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {behaviorStats?.funnel.map((step, i) => {
                const maxCount = behaviorStats.funnel[0]?.count || 1;
                const rate =
                  i === 0 ? "100%" : `${((step.count / maxCount) * 100).toFixed(1)}%`;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{step.step}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">{step.count}</span>
                        <span className="text-xs text-muted-foreground w-12 text-right">
                          {rate}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70 transition-all"
                        style={{
                          width: `${(step.count / maxCount) * 100}%`,
                          minWidth: step.count > 0 ? 8 : 0,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {!behaviorStats && (
                <div className="py-8 text-center text-muted-foreground">加载中...</div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
