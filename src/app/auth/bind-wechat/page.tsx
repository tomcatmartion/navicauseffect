"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * B-02：绑定微信
 *
 * 后端已实现（2026-06-26）：POST /api/auth/wechat/bind
 * - 真实模式：跳转微信 OAuth → redirect 回来后从 URL ?code=xxx 调 bind API
 * - mock 模式（未配置 WECHAT_APP_ID）：bind API 自动生成 mock openid 完成绑定
 *
 * 前端流程:
 *   1. 检查 URL 是否有 ?code=xxx（来自微信 OAuth redirect）
 *      - 有：立即调 bind API 提交 code
 *      - 无：显示扫码占位 +「跳转微信授权」按钮（点击跳 OAuth URL）
 *   2. mock 模式下显示「一键绑定（模拟）」按钮，点击调 bind API 用 mock code
 */
function BindWechatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oauthCode = searchParams.get("code");

  const [status, setStatus] = useState<"idle" | "binding" | "success" | "failed">(
    oauthCode ? "binding" : "idle",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [mockMode, setMockMode] = useState(false);

  // 检查是否 mock 模式（未配置 WECHAT_APP_ID）
  useEffect(() => {
    fetch("/api/auth/wechat")
      .then((r) => r.json())
      .then((data) => setMockMode(data.mock === true))
      .catch(() => setMockMode(true));
  }, []);

  // 自动绑定：URL 带 code（微信 OAuth redirect 回来）
  useEffect(() => {
    if (!oauthCode || status !== "binding") return;
    void doBind(oauthCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [oauthCode]);

  async function doBind(code: string) {
    setStatus("binding");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth/wechat/bind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("failed");
        setErrorMsg(data.error || "绑定失败");
        return;
      }
      setStatus("success");
      toast.success(data.mock ? "微信绑定成功（模拟模式）" : "微信绑定成功", { duration: 3000 });
    } catch {
      setStatus("failed");
      setErrorMsg("网络错误，请稍后重试");
    }
  }

  const handleStartOAuth = async () => {
    try {
      const res = await fetch("/api/auth/wechat");
      const data = await res.json();
      if (data.mock) {
        // mock 模式：直接调 bind API（code 用占位，后端会生成 mock openid）
        await doBind("MOCK_SCAN_CODE");
        return;
      }
      if (data.url) {
        // 真实模式：跳转微信 OAuth
        window.location.href = data.url;
      } else {
        toast.error("微信登录未配置");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: 380 }}>
        <div className="auth-head">
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 14px",
              background: "linear-gradient(135deg, #07c160, #05a350)",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              fontSize: 28,
            }}
          >
            <i className="ti ti-brand-wechat" />
          </div>
          <h2>绑定微信</h2>
          <p>授权后即可使用微信扫码快速登录此账号</p>
        </div>

        {status === "idle" && (
          <div style={{ textAlign: "center" }}>
            {/* 二维码占位 */}
            <div
              style={{
                width: 200,
                height: 200,
                margin: "0 auto 20px",
                background: "#fff",
                border: "1px solid var(--line)",
                borderRadius: "var(--radius-sm)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: 160,
                  height: 160,
                  background: `repeating-linear-gradient(
                    0deg,
                    #000 0px,
                    #000 6px,
                    #fff 6px,
                    #fff 12px
                  ),
                  repeating-linear-gradient(
                    90deg,
                    #000 0px,
                    #000 6px,
                    #fff 6px,
                    #fff 12px
                  )`,
                  backgroundBlendMode: "multiply",
                  opacity: 0.85,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    background: "#07c160",
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#fff",
                    fontSize: 24,
                  }}
                >
                  <i className="ti ti-brand-wechat" />
                </div>
              </div>
            </div>

            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
              点击下方按钮，{mockMode ? "一键模拟绑定（开发环境）" : "将跳转微信完成授权"}
            </p>

            <button
              type="button"
              className="btn btn-primary"
              onClick={handleStartOAuth}
              disabled={status !== "idle"}
              style={{ background: "#07c160", borderColor: "#07c160" }}
            >
              <i className="ti ti-brand-wechat" style={{ marginRight: 6 }} />
              {mockMode ? "一键绑定（模拟）" : "跳转微信授权"}
            </button>
          </div>
        )}

        {status === "binding" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <i
              className="ti ti-loader-2 ti-spin"
              style={{ fontSize: 32, color: "#07c160", marginBottom: 12 }}
            />
            <p style={{ fontSize: 14, color: "var(--text-muted)" }}>正在绑定微信…</p>
          </div>
        )}

        {status === "success" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 16px",
                background: "rgba(7,193,96,0.1)",
                color: "#07c160",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              <i className="ti ti-check" />
            </div>
            <h3 style={{ fontSize: 17, color: "var(--brand)", marginBottom: 6 }}>微信绑定成功</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              您可以使用微信扫码快速登录了
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push("/profile")}
            >
              返回个人中心
            </button>
          </div>
        )}

        {status === "failed" && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 16px",
                background: "rgba(239,68,68,0.1)",
                color: "var(--danger, #ef4444)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              <i className="ti ti-x" />
            </div>
            <h3 style={{ fontSize: 17, color: "var(--brand)", marginBottom: 6 }}>绑定失败</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              {errorMsg || "二维码已过期或授权被取消"}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStatus("idle")}
            >
              重新尝试
            </button>
          </div>
        )}

        <div className="auth-foot" style={{ marginTop: 22 }}>
          <Link href="/profile">返回个人中心</Link>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {mockMode ? "模拟模式（开发环境）" : "授权后将自动绑定"}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * 外层包 Suspense 边界（Next.js 静态预渲染硬要求：useSearchParams 必须在 Suspense 内）
 */
export default function BindWechatPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-card" style={{ maxWidth: 380, textAlign: "center" }}>
            <i
              className="ti ti-loader-2 ti-spin"
              style={{ fontSize: 28, color: "var(--text-muted)" }}
            />
          </div>
        </div>
      }
    >
      <BindWechatContent />
    </Suspense>
  );
}
