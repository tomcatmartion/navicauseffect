"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/**
 * S-08：统一付费前置弹层组件
 *
 * 当业务 API 返回 402（INSUFFICIENT_FUNDS / DAILY_LIMIT_EXCEEDED 等）时调用，
 * 给用户明确的「会员免费 / 充值星币」双 CTA，替代各页散落的 toast。
 *
 * 用法：
 *   import { usePaywall, PaywallProvider } from "@/components/shared/paywall-dialog";
 *   // 在 root layout 包裹 <PaywallProvider>
 *   // 在业务页：
 *   const { showPaywall } = usePaywall();
 *   if (res.status === 402) showPaywall({ reason: "INSUFFICIENT_FUNDS" });
 */

export interface PaywallOptions {
  /** 错误码（与后端 consume-rights.ts 对齐） */
  reason?: "INSUFFICIENT_FUNDS" | "DAILY_LIMIT_EXCEEDED" | "MEMBERSHIP_REQUIRED" | string;
  /** 错误原文（fallback 显示） */
  message?: string;
  /** 资源类型（用于定制文案） */
  resource?: "READING" | "REPORT" | "COMPATIBILITY" | "ANALYSIS" | string;
}

interface PaywallState extends PaywallOptions {
  open: boolean;
}

const DEFAULT_STATE: PaywallState = { open: false };

let setStateRef: ((s: PaywallState) => void) | null = null;

function getResourceLabel(resource?: string): string {
  switch (resource) {
    case "READING":
      return "AI 对话";
    case "REPORT":
      return "生成报告";
    case "COMPATIBILITY":
      return "合盘分析";
    case "ANALYSIS":
      return "深度分析";
    default:
      return "此功能";
  }
}

function getReasonTitle(reason: string | undefined, resource?: string): string {
  const label = getResourceLabel(resource);
  switch (reason) {
    case "INSUFFICIENT_FUNDS":
      return `星币不足，无法继续${label}`;
    case "DAILY_LIMIT_EXCEEDED":
      return `今日${label}次数已达上限`;
    case "MEMBERSHIP_REQUIRED":
      return `${label}仅限会员使用`;
    default:
      return `无法继续${label}`;
  }
}

function getReasonDesc(reason: string | undefined): string {
  switch (reason) {
    case "INSUFFICIENT_FUNDS":
      return "您的星币余额不足。开通会员可享受对应额度免费使用，或充值星币继续使用。";
    case "DAILY_LIMIT_EXCEEDED":
      return "非会员每日有免费额度限制。开通会员可解除限制，畅享无限次使用。";
    case "MEMBERSHIP_REQUIRED":
      return "此功能为会员专属。开通会员即可使用全部高级功能。";
    default:
      return "请开通会员或充值星币后继续使用。";
  }
}

/**
 * Provider：挂在 root layout，承担弹层 UI + 全局状态。
 */
export function PaywallProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PaywallState>(DEFAULT_STATE);

  useEffect(() => {
    setStateRef = (s) => setState(s);
    return () => {
      setStateRef = null;
    };
  }, []);

  const close = () => setState(DEFAULT_STATE);

  return (
    <>
      {children}
      {state.open && (
        <div
          onClick={close}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="card"
            style={{
              padding: 0,
              maxWidth: 380,
              width: "100%",
              background: "var(--panel)",
              overflow: "hidden",
            }}
          >
            {/* 顶部带渐变 */}
            <div
              style={{
                padding: "20px 20px 16px",
                background: "linear-gradient(135deg, var(--brand), var(--brand-dark, var(--brand)))",
                color: "#fff",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <i className="ti ti-crown" style={{ fontSize: 28 }} />
                <button
                  type="button"
                  onClick={close}
                  aria-label="关闭"
                  style={{
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#fff",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    cursor: "pointer",
                    fontSize: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <i className="ti ti-x" />
                </button>
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, margin: "10px 0 4px" }}>
                {getReasonTitle(state.reason, state.resource)}
              </h3>
              <p style={{ fontSize: 12, opacity: 0.9, margin: 0 }}>
                {state.message ?? getReasonDesc(state.reason)}
              </p>
            </div>

            {/* 双 CTA */}
            <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <Link
                href="/pricing?tab=membership"
                onClick={close}
                style={{
                  display: "block",
                  padding: "10px 14px",
                  background: "var(--brand)",
                  color: "#fff",
                  borderRadius: "var(--radius-sm)",
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <i className="ti ti-crown" style={{ marginRight: 6 }} />
                开通会员 · 解除限制
              </Link>
              <Link
                href="/pricing?tab=coins"
                onClick={close}
                style={{
                  display: "block",
                  padding: "10px 14px",
                  background: "var(--soft)",
                  color: "var(--brand)",
                  border: "1px solid var(--brand)",
                  borderRadius: "var(--radius-sm)",
                  textAlign: "center",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                <i className="ti ti-coin" style={{ marginRight: 6 }} />
                充值星币 · 立即可用
              </Link>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  textAlign: "center",
                  margin: "4px 0 0",
                }}
              >
                遇到问题？<Link href="/legal/terms" style={{ color: "inherit" }}>查看权益说明</Link>
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Hook：在业务组件中调用 showPaywall。
 */
export function usePaywall() {
  return {
    showPaywall: (options: PaywallOptions) => {
      if (setStateRef) {
        setStateRef({ ...options, open: true });
      }
    },
    closePaywall: () => {
      if (setStateRef) setStateRef(DEFAULT_STATE);
    },
  };
}
