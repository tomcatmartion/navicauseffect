"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

interface ReportItem {
  id: string;
  reportDate: string;
  keyword: string;
  summary: string;
  trendCount: number;
  topDomains: Array<{ domain: string; count: number }>;
  topKeywords: Array<{ question: string; count: number }>;
}

function DomainBar({ data }: { data: Array<{ domain: string; count: number }> }) {
  if (!data.length) return <span className="text-xs text-muted-foreground">无</span>
  const max = Math.max(...data.map((d) => d.count), 1)
  return (
    <div className="flex flex-wrap gap-2">
      {data.map((d) => (
        <span
          key={d.domain}
          className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs"
        >
          {d.domain} {d.count}
          <span
            className="ml-1 h-1.5 rounded-full bg-primary"
            style={{ width: `${(d.count / max) * 16}px`, minWidth: 4 }}
          />
        </span>
      ))}
    </div>
  )
}

function KeywordChips({ data }: { data: Array<{ question: string; count: number }> }) {
  if (!data.length) return <span className="text-xs text-muted-foreground">无</span>
  return (
    <div className="flex flex-wrap gap-1">
      {data.map((k) => (
        <span
          key={k.question}
          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          title={k.question}
        >
          {k.question.length > 15 ? k.question.slice(0, 15) + '...' : k.question}
          <span className="ml-1 font-medium text-foreground">{k.count}</span>
        </span>
      ))}
    </div>
  )
}

export default function ReportsHistory() {
  const [reports, setReports] = useState<ReportItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchReports = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/admin/sentiment/reports")
      if (!res.ok) throw new Error("加载失败")
      const data = await res.json()
      setReports(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReports()
  }, [])

  // 按日期分组
  const byDate: Record<string, ReportItem[]> = {}
  for (const r of reports) {
    const d = r.reportDate.slice(0, 10)
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(r)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">历史报告</h3>
        <Button variant="outline" size="sm" onClick={fetchReports} disabled={loading}>
          <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : sortedDates.length === 0 ? (
        <p className="text-sm text-muted-foreground">暂无报告数据</p>
      ) : (
        <div className="space-y-4">
          {sortedDates.map((date) => (
            <Card key={date}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">{date}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {byDate[date].map((r) => (
                  <div key={r.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium">
                          {r.keyword}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.trendCount} 条问题
                        </span>
                      </div>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{r.summary}</p>
                    <div className="mt-2 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs text-muted-foreground">领域</span>
                        <DomainBar data={r.topDomains} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="w-12 text-xs text-muted-foreground">热词</span>
                        <KeywordChips data={r.topKeywords} />
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}