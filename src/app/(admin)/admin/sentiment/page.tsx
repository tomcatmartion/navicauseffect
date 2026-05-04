"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Copy, Check } from "lucide-react";
import ReportsHistory from "./components/reports-history";

const DOMAIN_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "事业", label: "事业" },
  { value: "财运", label: "财运" },
  { value: "感情", label: "感情" },
  { value: "健康", label: "健康" },
  { value: "子女", label: "子女" },
  { value: "六亲", label: "六亲" },
];

const today = new Date().toISOString().slice(0, 10);
const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

// 简单文字柱状图组件
function TextBarChart({
  data,
  maxWidth = 300,
}: {
  data: Array<{ label: string; value: number }>;
  maxWidth?: number;
}) {
  if (!data.length) return <p className="text-xs text-muted-foreground">无数据</p>;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.slice(0, 10).map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-20 shrink-0 truncate text-right text-muted-foreground">{d.label}</span>
          <div className="relative flex-1 rounded bg-muted">
            <div
              className="h-5 rounded bg-primary/70 transition-all"
              style={{ width: `${(d.value / maxVal) * 100}%`, minWidth: d.value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="w-10 text-right font-medium">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

// 领域分布饼图（文字版）
function DomainPieChart({ data }: { data: Array<{ domain: string; count: number }> }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">无数据</p>;
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <div className="space-y-2">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-3 text-xs">
          <span
            className="h-3 w-3 shrink-0 rounded-full"
            style={{
              backgroundColor: [
                "#6366f1", "#8b5cf6", "#ec4899",
                "#f59e0b", "#10b981", "#3b82f6",
                "#ef4444", "#14b8a6", "#84cc16",
              ][i % 9],
            }}
          />
          <span className="w-16 truncate">{d.domain || '未知'}</span>
          <span className="font-medium">{d.count}</span>
          <span className="text-muted-foreground">({total > 0 ? ((d.count / total) * 100).toFixed(1) : 0}%)</span>
        </div>
      ))}
    </div>
  );
}

// 趋势折线图（文字 ASCII 版）
function TrendChart({ data }: { data: Array<{ date: string; count: number }> }) {
  if (!data.length) return <p className="text-xs text-muted-foreground">无数据</p>;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const minVal = Math.min(...data.map((d) => d.count), 0);
  const range = maxVal - minVal || 1;

  const height = 8;
  const bars = data.map((d) => {
    const normalized = Math.round(((d.count - minVal) / range) * (height - 1));
    return Array.from({ length: height }, (_, i) =>
      i >= height - 1 - normalized ? "█" : "░"
    ).join("");
  });

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-0.5 text-[10px] font-mono text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${Math.max(24, 600 / data.length)}px` }} title={d.date}>
            {bars[i]}
          </span>
        ))}
      </div>
      <div className="flex gap-0.5 text-[10px] text-muted-foreground">
        {data.map((d, i) => (
          <span key={i} style={{ width: `${Math.max(24, 600 / data.length)}px` }} className="truncate">
            {d.date.slice(5)}
          </span>
        ))}
      </div>
    </div>
  );
}

interface AnalyzeResult {
  sql: string;
  trend: Array<{ date: string; count: number }>;
  keywords: Array<{ question: string; count: number }>;
  domains: Array<{ domain: string; count: number }>;
  analysis: string;
}

export default function SentimentPage() {
  const [keyword, setKeyword] = useState("");
  const [startDate, setStartDate] = useState(thirtyDaysAgo);
  const [endDate, setEndDate] = useState(today);
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const handleAnalyze = async () => {
    if (!keyword.trim()) {
      setError("请输入统计关键词");
      return;
    }
    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/admin/sentiment/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword, startDate, endDate, domain: domain && domain !== 'all' ? domain : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析失败");
      setResult(data as AnalyzeResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySql = async () => {
    if (!result?.sql) return;
    try {
      await navigator.clipboard.writeText(result.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">舆情统计分析</h2>

      {/* 查询表单 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">查询条件</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="keyword">统计关键词</Label>
              <Input
                id="keyword"
                placeholder="如：事业、创业、求职"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="startDate">开始日期</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="endDate">结束日期</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">领域筛选</Label>
              <Select value={domain} onValueChange={setDomain}>
                <SelectTrigger id="domain">
                  <SelectValue placeholder="全部领域" />
                </SelectTrigger>
                <SelectContent>
                  {DOMAIN_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          <Button onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                AI 分析中...
              </>
            ) : (
              "生成分析报告"
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 统计图表区 */}
      {result && (
        <>
          {/* 趋势图 + 领域分布 */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">问题数量趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <TrendChart data={result.trend} />
                {result.trend.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    共 {result.trend.reduce((s, d) => s + d.count, 0)} 条问题
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">领域分布</CardTitle>
              </CardHeader>
              <CardContent>
                <DomainPieChart data={result.domains} />
              </CardContent>
            </Card>
          </div>

          {/* 热门关键词 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">热门问题关键词（TOP 10）</CardTitle>
            </CardHeader>
            <CardContent>
              <TextBarChart
                data={result.keywords.map((k) => ({
                  label: k.question.length > 20 ? k.question.slice(0, 20) + "..." : k.question,
                  value: k.count,
                }))}
              />
            </CardContent>
          </Card>

          {/* AI 分析结论 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">AI 分析结论</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
                {result.analysis}
              </div>
            </CardContent>
          </Card>

          {/* SQL 显示 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">生成的 SQL 查询</CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopySql}>
                {copied ? <Check className="mr-1 h-4 w-4" /> : <Copy className="mr-1 h-4 w-4" />}
                {copied ? "已复制" : "复制"}
              </Button>
            </CardHeader>
            <CardContent>
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-xs font-mono">
                {result.sql}
              </pre>
            </CardContent>
          </Card>
        </>
      )}

      {/* 历史报告 */}
      <ReportsHistory />
    </div>
  );
}