"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";

const PHONE_REGEX = /^1[3-9]\d{9}$/;

/**
 * B-01：找回密码流程
 *
 * 后端已实现（2026-06-26）：
 * - POST /api/auth/send-reset-code  发送重置验证码（仅对已注册手机号真实发码）
 * - POST /api/auth/forgot-password  验证码 + 新密码（bcrypt 更新）
 *
 * 安全特性：
 * - 未注册手机号返回成功但不实际发码（防账号枚举）
 * - 验证码 60s 频率限制 + 5 分钟过期
 */
export default function ForgotPasswordPage() {

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handleSendCode = async () => {
    const trimmed = phone.trim();
    if (!PHONE_REGEX.test(trimmed)) {
      setError("请输入正确的 11 位手机号");
      return;
    }
    setError("");
    try {
      const res = await fetch("/api/auth/send-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "验证码发送失败");
        return;
      }
      setCountdown(60);
      const maskedPhone = trimmed.replace(/(\d{3})\d{4}(\d{4})/, "$1****$2");
      toast.success(
        data.mock
          ? `开发环境验证码：${data.hint || "123456"}（已发送至 ${maskedPhone}）`
          : `验证码已发送至 ${maskedPhone}`,
        { duration: 4000 },
      );
    } catch {
      setError("网络错误，请稍后重试");
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmedCode = code.trim();
    if (!/^\d{6}$/.test(trimmedCode)) {
      setError("请输入 6 位验证码");
      return;
    }
    setStep(2);
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("密码长度至少 6 位");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          code: code.trim(),
          newPassword: password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "重置失败");
        setLoading(false);
        return;
      }
      setStep(3);
      toast.success("密码重置成功", { duration: 3000 });
    } catch {
      setError("网络错误，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
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
              borderRadius: "50%",
              fontSize: 28,
            }}
          >
            <i className="ti ti-lock" />
          </div>
          <h2>找回密码</h2>
          <p>验证手机号后重置登录密码</p>
        </div>

        {/* 步骤指示 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginBottom: 24,
          }}
        >
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 600,
                background: step >= s ? "var(--brand)" : "var(--soft)",
                color: step >= s ? "#fff" : "var(--text-muted)",
              }}
            >
              {s}
            </div>
          ))}
        </div>

        {error && (
          <div
            style={{
              padding: "10px 12px",
              marginBottom: 16,
              background: "rgba(239,68,68,0.08)",
              color: "var(--danger, #ef4444)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13,
            }}
          >
            <i className="ti ti-alert-circle" style={{ marginRight: 6 }} />
            {error}
          </div>
        )}

        {step === 1 && (
          <form onSubmit={handleVerifyCode}>
            <div className="field">
              <label className="field-label">手机号</label>
              <input
                className="input"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入注册手机号"
                maxLength={11}
                autoFocus
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
                  placeholder="6 位验证码"
                  maxLength={6}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={handleSendCode}
                  disabled={countdown > 0}
                >
                  {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                </button>
              </div>
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: "100%", marginTop: 8 }}>
              下一步
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleReset}>
            <div className="field">
              <label className="field-label">新密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="至少 6 位字符"
                minLength={6}
                autoFocus
              />
            </div>
            <div className="field">
              <label className="field-label">确认新密码</label>
              <input
                className="input"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              {loading ? "重置中…" : "重置密码"}
            </button>
          </form>
        )}

        {step === 3 && (
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <div
              style={{
                width: 64,
                height: 64,
                margin: "0 auto 16px",
                background: "rgba(34,197,94,0.1)",
                color: "var(--success, #22c55e)",
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 32,
              }}
            >
              <i className="ti ti-check" />
            </div>
            <h3 style={{ fontSize: 17, color: "var(--brand)", marginBottom: 6 }}>密码重置成功</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20 }}>
              请使用新密码重新登录
            </p>
            <Link href="/auth/login" className="btn btn-primary" style={{ display: "inline-block" }}>
              去登录
            </Link>
          </div>
        )}

        <div className="auth-foot" style={{ marginTop: 22 }}>
          <Link href="/auth/login">返回登录</Link>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>验证码将通过短信发送</span>
        </div>
      </div>
    </div>
  );
}
