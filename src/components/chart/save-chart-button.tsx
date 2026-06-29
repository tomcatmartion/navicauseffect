"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { TIME_INDEX_TO_HOUR } from "@/lib/ziwei/time-index";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface Identity {
  id: string;
  name: string;
  gender: string;
  relation: string;
  isActive: boolean;
}

interface SaveChartButtonProps {
  /** 从 sessionStorage 中读取的出生信息 */
  birthInfo: {
    gender: "MALE" | "FEMALE";
    year: number;
    month: number;
    day: number;
    hour: number;
    solar?: boolean;
    birthCity?: string;
    trueSolarTimeInfo?: string;
    parentBirthYears?: { father?: number; mother?: number };
  };
  /** 命盘已显示时调用，按钮才会显示 */
  visible: boolean;
  /**
   * 当前命盘的序列化数据（serializeAstrolabeForReading 输出）
   * 提供时：保存接口复用此数据作为 reading，避免服务端重排导致与用户所见不一致
   */
  chartData?: Record<string, unknown> | null;
  /** 样式类名（默认 outline） */
  variant?: "outline" | "default" | "ghost";
  size?: "sm" | "default";
}

export function SaveChartButton({
  birthInfo,
  visible,
  chartData,
  variant = "outline",
  size = "sm",
}: SaveChartButtonProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [selectedIdentityId, setSelectedIdentityId] = useState<string>("");
  const [chartName, setChartName] = useState("");
  const [chartNote, setChartNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingIdentities, setFetchingIdentities] = useState(false);

  // 构建生日字符串（用于 API）
  // birthInfo.hour 是 iztro timeIndex (0-12)，用 TIME_INDEX_TO_HOUR 映射到该时辰的代表小时
  // 映射表来自 @/lib/ziwei/time-index（与 chart-snapshot-builder 共用，保证 DB 指纹一致）
  const hour24 = TIME_INDEX_TO_HOUR[birthInfo.hour] ?? 12
  const birthdayStr = `${birthInfo.year}-${String(birthInfo.month).padStart(2, "0")}-${String(birthInfo.day).padStart(2, "0")} ${String(hour24).padStart(2, "0")}:00`;

  // 加载命主列表
  const fetchIdentities = async () => {
    setFetchingIdentities(true);
    try {
      const res = await fetch("/api/identities");
      if (res.ok) {
        const data = await res.json();
        const list = data.identities ?? [];
        setIdentities(list);
        // 默认选 active 命主或第一个
        const active = list.find((i: Identity) => i.isActive);
        const picked = active ?? list[0];
        setSelectedIdentityId(picked?.id ?? "");
        // O-05：把命主名补进默认盘别名（仅当用户尚未手动修改时）
        if (picked) {
          const dateStr = `${birthInfo.year}/${String(birthInfo.month).padStart(2, "0")}/${String(birthInfo.day).padStart(2, "0")}`;
          const cityPart = birthInfo.birthCity ? `-${birthInfo.birthCity}` : "";
          setChartName(`${picked.name}-${dateStr}${cityPart}-${birthInfo.hour}时`);
        }
      }
    } finally {
      setFetchingIdentities(false);
    }
  };

  const handleClick = () => {
    if (status !== "authenticated") {
      toast.info("请先登录后保存");
      router.push("/auth/login");
      return;
    }
    // B-17：微信登录未绑定手机的用户，保存命盘前强制引导绑定
    if ((session?.user as { phoneBindingRequired?: boolean }).phoneBindingRequired) {
      toast.info("微信登录用户需先绑定手机号，才能保存命盘");
      router.push(`/auth/bind-phone?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }
    // O-05：默认盘别名 = 命主名-城市-YYYY/MM/DD（用户可改）
    // 命主名在 fetchIdentities 完成后才能填入，所以这里先放占位，handleIdentityLoaded 时再补
    const dateStr = `${birthInfo.year}/${String(birthInfo.month).padStart(2, "0")}/${String(birthInfo.day).padStart(2, "0")}`;
    const cityPart = birthInfo.birthCity ? `-${birthInfo.birthCity}` : "";
    setChartName(`${dateStr}${cityPart}-${birthInfo.hour}时`);
    setOpen(true);
    fetchIdentities();
  };

  const handleSave = async () => {
    if (!selectedIdentityId) {
      toast.error("请选择命主");
      return;
    }
    if (!chartName.trim()) {
      toast.error("请填写盘别名");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/charts/save-from-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identityId: selectedIdentityId,
          name: chartName.trim(),
          birthInfo: {
            gender: birthInfo.gender,
            birthday: birthdayStr,
            birthCity: birthInfo.birthCity,
            region: birthInfo.birthCity, // 兼容字段（region 字段也用同值，便于真太阳时校正匹配）
          },
          chartData: chartData ?? undefined,
          note: chartNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.success("命盘已保存");
        setOpen(false);
        // 跳转到详情页
        if (data.chart?.id) {
          router.push(`/charts/${data.chart.id}`);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error ?? "保存失败");
      }
    } catch {
      toast.error("网络错误");
    } finally {
      setLoading(false);
    }
  };

  if (!visible) return null;

  // variant 映射到 testUI btn 类
  const btnClass = [
    "btn",
    variant === "default" ? "btn-primary" : "btn-ghost",
    size === "sm" ? "btn-sm" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <button type="button" onClick={handleClick} className={`${btnClass} shrink-0`}>
        <i className="ti ti-bookmark" style={{ marginRight: 4 }} />
        保存为命盘
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="paywall-dialog max-w-md">
          <DialogHeader>
            <DialogTitle>保存为命盘</DialogTitle>
            <DialogDescription>
              保存后可在 AI 解盘、生成报告、合盘分析中随时调出，无需重排
            </DialogDescription>
          </DialogHeader>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "8px 0" }}>
            {/* 命主选择 */}
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>归属命主</label>
              {fetchingIdentities ? (
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
                  <i className="ti ti-loader-2 ti-spin" /> 加载命主列表...
                </div>
              ) : identities.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ fontSize: 12, color: "var(--text-muted)" }}>还没有命主，请先创建</p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ fontSize: 12, alignSelf: "flex-start" }}
                    onClick={() => {
                      setOpen(false);
                      router.push("/profile?from=chart");
                    }}
                  >
                    去创建命主
                  </button>
                </div>
              ) : (
                <select
                  value={selectedIdentityId}
                  onChange={(e) => setSelectedIdentityId(e.target.value)}
                  className="select"
                >
                  {identities.map((identity) => (
                    <option key={identity.id} value={identity.id}>
                      {identity.name}（{identity.gender === "MALE" ? "男" : "女"}）
                      {identity.isActive ? " · 当前活跃" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 盘别名 */}
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>盘别名</label>
              <input
                value={chartName}
                onChange={(e) => setChartName(e.target.value)}
                placeholder="如：本人-午时-真太阳时校正"
                className="input"
              />
            </div>

            {/* 备注 */}
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>备注（可选）</label>
              <input
                value={chartNote}
                onChange={(e) => setChartNote(e.target.value)}
                placeholder="如：母亲提供的是阴历"
                className="input"
              />
            </div>

            {/* 出生信息回显 */}
            <div style={{
              borderRadius: 8,
              background: "var(--soft)",
              padding: "8px 12px",
              fontSize: 12,
              color: "var(--text-muted)",
            }}>
              {birthInfo.year}-{String(birthInfo.month).padStart(2, "0")}-{String(birthInfo.day).padStart(2, "0")} ·{" "}
              {birthInfo.hour}时 · {birthInfo.gender === "MALE" ? "男" : "女"}
              {birthInfo.birthCity ? ` · ${birthInfo.birthCity}` : ""}
            </div>
          </div>

          <DialogFooter>
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={loading}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={loading || !selectedIdentityId || !chartName.trim()}
            >
              {loading ? <i className="ti ti-loader-2 ti-spin" /> : "保存"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
