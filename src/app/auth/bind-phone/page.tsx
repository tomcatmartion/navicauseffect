"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * 微信扫码新用户绑定手机号页面
 *
 * 仅在 session.phoneBindingRequired === true 时可访问,
 * 否则跳首页(防止已绑定用户直接访问)
 */
export default function BindPhonePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 检查 session 状态
  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/login");
      return;
    }
    // 已登录但 phoneBindingRequired 为 false,跳首页
    if (status === "authenticated" && session?.user?.phoneBindingRequired === false) {
      router.replace("/");
    }
  }, [status, session, router]);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async (): Promise<void> => {
    if (!phone) {
      toast.error("请先输入手机号");
      return;
    }
    if (!PHONE_REGEX.test(phone)) {
      toast.error("手机号格式不合法");
      return;
    }
    if (countdown > 0) return;
    try {
      const res = await fetch("/api/auth/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "发送失败");
        return;
      }
      setCountdown(60);
      if (data.mock) {
        toast.success("开发环境验证码为 123456", { duration: 5000 });
      } else {
        toast.success("验证码已发送");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleBind = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/bind-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "绑定失败");
        setLoading(false);
        return;
      }
      // 触发 session 刷新,清除 phoneBindingRequired
      await update();
      toast.success("手机号绑定成功");
      window.location.href = "/";
    } catch {
      setError("网络错误,请稍后重试");
      setLoading(false);
    }
  };

  // 加载中
  if (status === "loading") {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div style={{ textAlign: "center", padding: 40 }}>
            <i
              className="ti ti-loader-2 ti-spin"
              style={{ fontSize: 28, color: "var(--brand)" }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* 头部 */}
        <div className="auth-head">
          <div
            style={{
              width: 56,
              height: 56,
              margin: "0 auto 14px",
              background: "linear-gradient(135deg, var(--brand), var(--brand-dark))",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
              borderRadius: "50%",
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <i className="ti ti-device-mobile" />
          </div>
          <h2>绑定手机号</h2>
          <p>首次微信登录需绑定手机号,以保障账号安全</p>
        </div>

        {/* 说明卡 */}
        <div className="help-note" style={{ marginBottom: 20 }}>
          <i className="ti ti-info-circle" />
          <span>
            你的微信账号已创建,绑定手机号后即可正常使用所有功能。后续也可用手机号验证码登录。
          </span>
        </div>

        {/* 错误提示 */}
        {error && (
          <div
            className="help-note"
            style={{
              marginBottom: 16,
              borderColor: "var(--danger)",
              color: "var(--danger)",
            }}
          >
            <i className="ti ti-alert-circle" />
            <span>{error}</span>
          </div>
        )}

        {/* 表单 */}
        <form onSubmit={handleBind}>
          <div className="field">
            <label className="field-label">手机号</label>
            <input
              className="input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="11 位手机号"
              maxLength={11}
              required
            />
          </div>
          <div className="field">
            <label className="field-label">验证码</label>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                className="input"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="6 位短信验证码"
                maxLength={6}
                required
              />
              <button
                type="button"
                className="btn btn-ghost"
                style={{ whiteSpace: "nowrap" }}
                onClick={handleSendCode}
                disabled={countdown > 0}
              >
                {countdown > 0 ? `${countdown}s` : "获取验证码"}
              </button>
            </div>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8 }}
            disabled={loading}
          >
            <i className="ti ti-link" style={{ marginRight: 6 }} />
            {loading ? "绑定中…" : "绑定并继续"}
          </button>
        </form>
      </div>
    </div>
  );
}
