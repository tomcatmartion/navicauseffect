"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

interface ChartSummary {
  id: string;
  identityId: string;
  name: string;
  birthSolarDate: string;
  birthCity: string | null;
  timeIndex: number;
  gender: "MALE" | "FEMALE";
  isPrimary: boolean;
  source: "MANUAL" | "IMPORTED" | "CHAT" | "REPORT";
  note: string | null;
  chartFingerprint: string;
  summary: {
    solarDate: string;
    lunarDate: string;
    mingGongMajorStars: string[];
    shenGongName: string;
    birthGanZhi: string;
    zodiac: string;
    fiveElementsClass: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

interface IdentityBrief {
  id: string;
  name: string;
  gender: string;
  relation: string;
}

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

const SOURCE_LABELS: Record<ChartSummary["source"], string> = {
  MANUAL: "手动",
  IMPORTED: "自动",
  CHAT: "对话",
  REPORT: "报告",
};

function timeIndexLabel(idx: number): string {
  const labels = ["子早", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥", "子晚"];
  return labels[idx] ?? "?";
}

// ---------------------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------------------

export default function ChartsListPage() {
  const { status: sessionStatus } = useSession();
  const router = useRouter();

  const [charts, setCharts] = useState<ChartSummary[]>([]);
  const [identities, setIdentities] = useState<IdentityBrief[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<ChartSummary | null>(null);
  const [deleting, setDeleting] = useState(false);
  // S-04：搜索 / 筛选
  const [searchText, setSearchText] = useState("");
  const [filterIdentityId, setFilterIdentityId] = useState<string>("");

  const fetchCharts = useCallback(async () => {
    try {
      const res = await fetch("/api/charts");
      const data = await res.json();
      if (data.charts) setCharts(data.charts);
    } catch (e) {
      console.error("加载命盘失败:", e);
    }
  }, []);

  const fetchIdentities = useCallback(async () => {
    try {
      const res = await fetch("/api/identities");
      const data = await res.json();
      if (data.identities) setIdentities(data.identities);
    } catch (e) {
      console.error("加载命主失败:", e);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus !== "authenticated") return;
    setLoading(true);
    Promise.all([fetchCharts(), fetchIdentities()]).finally(() => setLoading(false));
  }, [sessionStatus, fetchCharts, fetchIdentities]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/charts/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "删除失败");
      }
      toast.success(`已删除「${deleteTarget.name}」`);
      setDeleteTarget(null);
      await fetchCharts();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchCharts]);

  const handleSetPrimary = useCallback(
    async (chart: ChartSummary) => {
      try {
        const res = await fetch(`/api/charts/${chart.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPrimary: true }),
        });
        if (!res.ok) throw new Error("设置失败");
        toast.success(`已将「${chart.name}」设为命主默认盘`);
        await fetchCharts();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "设置失败");
      }
    },
    [fetchCharts],
  );

  // 按命主分组
  const grouped = useMemo(() => {
    const map: Record<string, { identity?: IdentityBrief; charts: ChartSummary[] }> = {};
    for (const chart of charts) {
      if (!map[chart.identityId]) {
        map[chart.identityId] = { charts: [] };
      }
      map[chart.identityId].charts.push(chart);
    }
    for (const identity of identities) {
      if (map[identity.id]) {
        map[identity.id].identity = identity;
      }
    }
    // 每组内：默认盘排前 + 按更新时间倒序
    return Object.entries(map)
      .map(([identityId, group]) => ({
        identityId,
        identity: group.identity,
        charts: group.charts.sort((a, b) => {
          if (a.isPrimary !== b.isPrimary) return a.isPrimary ? -1 : 1;
          return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        }),
      }))
      .sort((a, b) => {
        const aHasPrimary = a.charts.some((c) => c.isPrimary) ? 0 : 1;
        const bHasPrimary = b.charts.some((c) => c.isPrimary) ? 0 : 1;
        return aHasPrimary - bHasPrimary;
      });
  }, [charts, identities]);

  // S-04：搜索 / 筛选后的分组
  const filteredGrouped = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return grouped
      .filter((g) => !filterIdentityId || g.identityId === filterIdentityId)
      .map((g) => ({
        ...g,
        charts: g.charts.filter((c) => {
          if (!q) return true;
          return (
            c.name.toLowerCase().includes(q) ||
            (c.note ?? "").toLowerCase().includes(q) ||
            (c.birthCity ?? "").toLowerCase().includes(q) ||
            (g.identity?.name ?? "").toLowerCase().includes(q)
          );
        }),
      }))
      .filter((g) => g.charts.length > 0);
  }, [grouped, searchText, filterIdentityId]);

  // 未登录
  if (sessionStatus === "unauthenticated") {
    return (
      <div style={{ maxWidth: 480, margin: "80px auto", padding: 24, textAlign: "center" }}>
        <i className="ti ti-lock" style={{ fontSize: 48, color: "var(--text-muted)" }} />
        <p style={{ marginTop: 16, color: "var(--text-muted)" }}>请先登录后查看命盘</p>
        <button className="btn btn-primary" onClick={() => router.push("/auth/login")}>
          去登录
        </button>
      </div>
    );
  }

  // 加载中
  if (loading) {
    return <LoadingSkeleton size="lg" style={{ minHeight: 400 }} />;
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "20px 24px 60px" }}>
      {/* 标题栏 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            className="home-section-title"
            style={{ margin: 0, fontSize: 18, color: "var(--brand)", fontFamily: "var(--font-head)" }}
          >
            <i className="ti ti-clipboard-list" style={{ marginRight: 8 }} />
            我的命盘
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            共 {charts.length} 张 · 按命主分组
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => router.push("/chart")}
        >
          <i className="ti ti-plus" style={{ marginRight: 4 }} />
          新建排盘
        </button>
      </div>

      {charts.length === 0 ? (
        <div className="card" style={{ padding: 32, textAlign: "center" }}>
          <i
            className="ti ti-clipboard-list"
            style={{ fontSize: 48, color: "var(--text-muted)", opacity: 0.4 }}
          />
          <p style={{ marginTop: 16, fontWeight: 600, color: "var(--brand)" }}>
            还没有保存的命盘
          </p>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            排盘后点击「保存为命盘」，可在 AI 对话、报告生成、合盘分析中复用
          </p>
          <button
            type="button"
            className="btn btn-primary"
            style={{ marginTop: 20 }}
            onClick={() => router.push("/chart")}
          >
            <i className="ti ti-plus" style={{ marginRight: 6 }} />
            开始排盘
          </button>
        </div>
      ) : (
        <>
          {/* S-04：搜索 + 筛选栏 */}
          <div
            style={{
              display: "flex",
              gap: 8,
              marginBottom: 16,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div
              style={{
                position: "relative",
                flex: 1,
                minWidth: 200,
              }}
            >
              <i
                className="ti ti-search"
                style={{
                  position: "absolute",
                  left: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: 14,
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                }}
              />
              <input
                className="input"
                placeholder="搜索命盘名 / 命主 / 城市"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  width: "100%",
                  paddingLeft: 32,
                  height: 36,
                }}
              />
            </div>
            {identities.length > 1 && (
              <select
                className="input"
                value={filterIdentityId}
                onChange={(e) => setFilterIdentityId(e.target.value)}
                style={{ height: 36, width: "auto", minWidth: 140 }}
              >
                <option value="">全部命主</option>
                {identities.map((idn) => (
                  <option key={idn.id} value={idn.id}>
                    {idn.name}
                  </option>
                ))}
              </select>
            )}
            {(searchText || filterIdentityId) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setSearchText("");
                  setFilterIdentityId("");
                }}
                style={{ fontSize: 12 }}
              >
                <i className="ti ti-x" /> 清除
              </button>
            )}
          </div>

          {/* S-04：搜索无结果 */}
          {filteredGrouped.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: "center" }}>
              <i
                className="ti ti-search"
                style={{ fontSize: 36, color: "var(--text-muted)", opacity: 0.4 }}
              />
              <p style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
                未找到匹配的命盘
              </p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 12 }}
                onClick={() => {
                  setSearchText("");
                  setFilterIdentityId("");
                }}
              >
                清空搜索条件
              </button>
            </div>
          ) : (
            filteredGrouped.map((group) => (
          <div key={group.identityId} style={{ marginBottom: 24 }}>
            {/* 命主分组标题 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 4px 8px",
                borderBottom: "1px solid var(--line-light)",
                marginBottom: 10,
              }}
            >
              <i className="ti ti-user" style={{ fontSize: 14, color: "var(--brand)" }} />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--brand)",
                  fontFamily: "var(--font-head)",
                }}
              >
                {group.identity?.name ?? "未知命主"}
              </span>
              {group.identity && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "2px 8px",
                    background: "var(--soft)",
                    border: "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--brand)",
                  }}
                >
                  {group.identity.gender === "MALE" ? "男" : "女"} ·{" "}
                  {group.identity.relation || "本人"}
                </span>
              )}
              <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto" }}>
                {group.charts.length} 张
              </span>
            </div>

            {/* 命盘卡片列表 */}
            <div>
              {group.charts.map((chart) => (
                <div
                  key={chart.id}
                  className="chart-list-item"
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/charts/${chart.id}`)}
                >
                  {/* thumb */}
                  <div
                    className="thumb"
                    style={{
                      background: chart.isPrimary ? "var(--brand)" : "var(--soft)",
                      color: chart.isPrimary ? "#fff" : "var(--brand)",
                    }}
                    title={chart.isPrimary ? "命主默认盘" : undefined}
                  >
                    {chart.isPrimary ? (
                      <i className="ti ti-crown" />
                    ) : (
                      chart.name.charAt(0) || "?"
                    )}
                  </div>

                  {/* info */}
                  <div className="info">
                    <div className="name">
                      {chart.name}
                      {chart.isPrimary && (
                        <span
                          style={{
                            marginLeft: 6,
                            fontSize: 10,
                            padding: "1px 6px",
                            background: "var(--brand)",
                            color: "#fff",
                            borderRadius: "var(--radius-sm)",
                          }}
                        >
                          默认
                        </span>
                      )}
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          padding: "1px 6px",
                          background: "var(--soft)",
                          border: "1px solid var(--line)",
                          borderRadius: "var(--radius-sm)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {SOURCE_LABELS[chart.source]}
                      </span>
                    </div>
                    {chart.summary ? (
                      <div className="meta">
                        命宫 <strong style={{ color: "var(--brand)" }}>
                          {chart.summary.mingGongMajorStars.join("·") || "空宫"}
                        </strong>{" "}
                        · 身宫 {chart.summary.shenGongName} ·{" "}
                        {chart.summary.birthGanZhi} · {chart.summary.fiveElementsClass}
                      </div>
                    ) : (
                      <div className="meta">
                        {chart.birthSolarDate} · {timeIndexLabel(chart.timeIndex)}时
                        {chart.birthCity ? ` · ${chart.birthCity}` : ""}
                      </div>
                    )}
                    {chart.note && (
                      <div
                        className="meta"
                        style={{ fontStyle: "italic", opacity: 0.7 }}
                      >
                        📝 {chart.note}
                      </div>
                    )}
                  </div>

                  {/* actions */}
                  <div
                    className="card-actions"
                    style={{ flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="AI 对话"
                      onClick={() => router.push(`/chart?chartRecordId=${chart.id}`)}
                    >
                      <i className="ti ti-message-2" /> AI 对话
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="生成报告"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/reports?chartRecordId=${chart.id}&identityId=${chart.identityId}`);
                      }}
                    >
                      <i className="ti ti-file-text" /> 生成报告
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm"
                      title="双人合盘"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/compatibility?selfChartId=${chart.id}`);
                      }}
                    >
                      <i className="ti ti-hearts" /> 双人合盘
                    </button>
                    {!chart.isPrimary && (
                      <button
                        type="button"
                        className="btn btn-sm"
                        title="设为命主默认盘"
                        onClick={() => handleSetPrimary(chart)}
                      >
                        <i className="ti ti-star" />
                      </button>
                    )}
                    <button
                      type="button"
                      className="iconbtn"
                      title="删除"
                      style={{ width: 32, height: 32 }}
                      onClick={() => setDeleteTarget(chart)}
                    >
                      <i className="ti ti-trash" style={{ fontSize: 14 }} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
          )}
        </>
      )}

      {/* 删除确认 */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="paywall-dialog" style={{ maxWidth: 400 }}>
          <DialogHeader>
            <DialogTitle>确认删除命盘</DialogTitle>
            <DialogDescription>
              将删除「{deleteTarget?.name}」，此操作不可恢复。
              {deleteTarget?.isPrimary && " 删除默认盘后会自动选取同命主最新盘为默认。"}
            </DialogDescription>
          </DialogHeader>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(null)} disabled={deleting}>
              取消
            </button>
            <button
              className="btn btn-sm"
              onClick={handleDelete}
              disabled={deleting}
              style={{ background: "var(--danger)", color: "#fff" }}
            >
              {deleting ? <i className="ti ti-loader-2 ti-spin" /> : "确认删除"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
