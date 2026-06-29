"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";

/**
 * 手机号格式校验(11 位,1 开头,第二位 3-9)
 */
const PHONE_REGEX = /^1[3-9]\d{9}$/;

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const wechatCode = searchParams.get("wechat_code");

  // Tab 切换
  const [activeTab, setActiveTab] = useState<"password" | "sms" | "register">("password");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // 账号密码 form
  const [account, setAccount] = useState("");
  const [password, setPassword] = useState("");

  // 手机验证码 form
  const [smsPhone, setSmsPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");

  // 注册 form
  const [regPhone, setRegPhone] = useState("");
  const [regCode, setRegCode] = useState("");
  const [regInviteCode, setRegInviteCode] = useState("");

  // 验证码倒计时(秒)
  const [smsCountdown, setSmsCountdown] = useState(0);
  const [regCountdown, setRegCountdown] = useState(0);

  // 微信登录是否配置(开发演示模式下 configured:true + mock:true)
  const [wechatConfigured, setWechatConfigured] = useState<boolean | null>(null);
  const [wechatMock, setWechatMock] = useState(false);

  // 从 localStorage / cookie 读 pendingInviteCode(首页 ?ref= 捕获的)
  // O-07：同时控制顶部邀请 banner 的显示
  const [hasInviteCode, setHasInviteCode] = useState(false);
  useEffect(() => {
    let stored = "";
    try {
      stored = localStorage.getItem("pendingInviteCode") ?? "";
    } catch {
      /* ignore */
    }
    if (!stored) {
      const m = document.cookie.match(/(?:^|;\s*)pendingInviteCode=([^;]+)/);
      if (m?.[1]) stored = decodeURIComponent(m[1]);
    }
    if (stored) {
      setRegInviteCode(stored);
      setHasInviteCode(true);
    }
  }, []);

  // 倒计时
  useEffect(() => {
    if (smsCountdown <= 0) return;
    const t = setTimeout(() => setSmsCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [smsCountdown]);

  useEffect(() => {
    if (regCountdown <= 0) return;
    const t = setTimeout(() => setRegCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [regCountdown]);

  // 检查微信扫码登录是否配置(开发演示模式也返回 configured:true)
  useEffect(() => {
    fetch("/api/auth/wechat")
      .then((r) => r.json())
      .then((data) => {
        setWechatConfigured(data.configured ?? false);
        setWechatMock(data.mock === true);
      })
      .catch(() => setWechatConfigured(false));
  }, []);

  // 微信扫码回调(带 wechat_code 参数)
  const handleWechatLogin = useCallback(
    async (code: string) => {
      setLoading(true);
      setError("");
      // 透传首页 ?ref= 捕获的邀请码,让 authorize 在新用户注册时触发邀请奖励
      let inviteCode = "";
      try {
        inviteCode = localStorage.getItem("pendingInviteCode") ?? "";
      } catch {
        /* ignore */
      }
      if (!inviteCode) {
        const m = document.cookie.match(/(?:^|;\s*)pendingInviteCode=([^;]+)/);
        if (m?.[1]) inviteCode = decodeURIComponent(m[1]);
      }
      const result = await signIn("wechat", {
        code,
        inviteCode: inviteCode || undefined,
        redirect: false,
      });
      setLoading(false);
      if (result?.error) {
        setError("微信登录失败,请重试");
        return;
      }
      if (result?.ok) {
        // 登录成功后,fetch session 检查是否需要绑定手机号
        try {
          const sessRes = await fetch("/api/auth/session");
          const sessData = await sessRes.json();
          if (sessData?.user?.phoneBindingRequired) {
            // 新用户微信扫码,跳绑定手机号页
            window.location.href = "/auth/bind-phone";
            return;
          }
        } catch {
          // session 检查失败,不阻断登录,正常跳 callbackUrl
        }
        window.location.href = callbackUrl;
      }
    },
    [callbackUrl],
  );

  useEffect(() => {
    if (wechatCode) {
      handleWechatLogin(wechatCode);
    }
  }, [wechatCode, handleWechatLogin]);

  // 发送验证码(注册 + 手机登录共用)
  const handleSendCode = async (
    phone: string,
    type: "sms" | "register",
  ): Promise<void> => {
    if (!phone) {
      toast.error("请先输入手机号");
      return;
    }
    if (!PHONE_REGEX.test(phone)) {
      toast.error("手机号格式不合法");
      return;
    }
    const countdown = type === "sms" ? smsCountdown : regCountdown;
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
      if (type === "sms") setSmsCountdown(60);
      else setRegCountdown(60);

      if (data.mock) {
        toast.success("开发环境验证码为 123456", { duration: 5000 });
      } else if (data.hint) {
        toast.success(data.hint, { duration: 4000 });
      } else {
        toast.success("验证码已发送");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  // 账号密码登录(兼容旧 admin 账号)
  const handlePasswordLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("credentials", {
      username: account.trim(),
      password: password.trim(),
      callbackUrl,
      redirect: false,
    });
    setLoading(false);
    if (result?.ok) {
      window.location.href = callbackUrl;
      return;
    }
    setError("账号或密码错误");
  };

  // 手机验证码登录
  const handleSmsLogin = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const result = await signIn("phone", {
      phone: smsPhone.trim(),
      code: smsCode.trim(),
      redirect: false,
    });
    setLoading(false);
    if (result?.ok) {
      window.location.href = callbackUrl;
      return;
    }
    setError("验证码错误或手机号未注册");
  };

  // 注册并自动登录
  const handleRegister = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const trimmedPhone = regPhone.trim();
      const trimmedCode = regCode.trim();
      const trimmedInvite = regInviteCode.trim().toUpperCase();

      // 1. 调注册 API
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: trimmedPhone,
          code: trimmedCode,
          inviteCode: trimmedInvite || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "注册失败");
        setLoading(false);
        return;
      }

      // 2. 自动用 phone provider 登录(checkCode 不删 code,phone provider 的 verifyCode 会消费)
      // B-10：注册后 session 写入有短暂竞态，自动重试最多 3 次，避免让用户手动登录
      let result = await signIn("phone", {
        phone: trimmedPhone,
        code: trimmedCode,
        redirect: false,
      });
      let attempts = 1;
      while (!result?.ok && attempts < 3) {
        await new Promise((r) => setTimeout(r, 400 * attempts));
        result = await signIn("phone", {
          phone: trimmedPhone,
          code: trimmedCode,
          redirect: false,
        });
        attempts++;
      }
      setLoading(false);
      if (result?.ok) {
        if (data.bonusPoints > 0) {
          toast.success(`注册成功!获得 ${data.bonusPoints} 星币`, { duration: 3000 });
        }
        window.location.href = callbackUrl;
      } else {
        // 注册成功但自动登录失败,引导用户手动登录
        toast.success("注册成功,请登录");
        setSmsPhone(trimmedPhone);
        setActiveTab("sms");
      }
    } catch {
      setError("注册失败,请稍后重试");
      setLoading(false);
    }
  };

  // 跳转微信扫码
  const handleWechatRedirect = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wechat");
      const data = await res.json();
      if (data.mock) {
        // 开发演示模式:不跳转,提示需要配置真实凭证
        toast.info(
          "微信扫码登录为演示入口,需在 .env 配置 WECHAT_APP_ID / WECHAT_APP_SECRET 后启用真实扫码",
          { duration: 5000 },
        );
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("微信登录未配置,请联系管理员");
        setLoading(false);
      }
    } catch {
      setError("微信登录暂不可用");
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // 渲染
  // ─────────────────────────────────────────────────────────

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* O-07：邀请码全局 banner（顶部，所有 Tab 都可见） */}
        {hasInviteCode && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              marginBottom: 16,
              background: "linear-gradient(135deg, var(--soft), var(--panel))",
              border: "1px solid var(--brand)",
              borderRadius: "var(--radius-sm)",
              fontSize: 12,
            }}
          >
            <i className="ti ti-gift" style={{ color: "var(--brand)", fontSize: 18 }} />
            <div style={{ flex: 1, lineHeight: 1.5 }}>
              您被好友邀请
              <span style={{ color: "var(--text-muted)" }}>（可在「注册」Tab 查看）</span>
              <br />
              <strong style={{ color: "var(--brand)" }}>注册即得 10 星币，邀请人也得 20 星币</strong>
            </div>
          </div>
        )}

        {/* 头部 logo */}
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
            微
          </div>
          <h2>紫微问道</h2>
          <p>观己 · 观人 · 观世界</p>
        </div>

        {/* Tab 切换 */}
        <div className="auth-tabs">
          <button
            type="button"
            className={activeTab === "password" ? "active" : ""}
            onClick={() => {
              setActiveTab("password");
              setError("");
            }}
          >
            账号密码
          </button>
          <button
            type="button"
            className={activeTab === "sms" ? "active" : ""}
            onClick={() => {
              setActiveTab("sms");
              setError("");
            }}
          >
            手机验证码
          </button>
          <button
            type="button"
            className={activeTab === "register" ? "active" : ""}
            onClick={() => {
              setActiveTab("register");
              setError("");
            }}
          >
            注册
          </button>
        </div>

        {/* 错误提示 */}
        {error && (
          <div
            className="help-note"
            style={{
              marginBottom: 16,
              borderColor: "var(--danger)",
              color: "var(--danger)",
              alignItems: "center",
            }}
          >
            <i className="ti ti-alert-circle" />
            <span style={{ flex: 1 }}>{error}</span>
            {activeTab === "register" && regPhone && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                style={{ marginLeft: 8, padding: "4px 10px", fontSize: 12 }}
                onClick={() => {
                  const form = document.getElementById("register-form") as HTMLFormElement | null;
                  form?.requestSubmit();
                }}
              >
                <i className="ti ti-refresh" /> 一键重试
              </button>
            )}
          </div>
        )}

        {/* Tab:账号密码 */}
        {activeTab === "password" && (
          <form onSubmit={handlePasswordLogin}>
            <div className="field">
              <label className="field-label">账号</label>
              <input
                className="input"
                type="text"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="用户名 / 手机号 / 邮箱"
                required
              />
            </div>
            <div className="field">
              <label className="field-label">密码</label>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              <i className="ti ti-login" style={{ marginRight: 6 }} />
              {loading ? "登录中…" : "登录"}
            </button>
          </form>
        )}

        {/* Tab:手机验证码 */}
        {activeTab === "sms" && (
          <form onSubmit={handleSmsLogin}>
            <div className="field">
              <label className="field-label">手机号</label>
              <input
                className="input"
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
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
                  value={smsCode}
                  onChange={(e) => setSmsCode(e.target.value)}
                  placeholder="6 位短信验证码"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => handleSendCode(smsPhone.trim(), "sms")}
                  disabled={smsCountdown > 0}
                >
                  {smsCountdown > 0 ? `${smsCountdown}s` : "获取验证码"}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              <i className="ti ti-login" style={{ marginRight: 6 }} />
              {loading ? "登录中…" : "登录"}
            </button>
          </form>
        )}

        {/* Tab:注册 */}
        {activeTab === "register" && (
          <form id="register-form" onSubmit={handleRegister}>
            <div className="field">
              <label className="field-label">手机号</label>
              <input
                className="input"
                type="tel"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
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
                  value={regCode}
                  onChange={(e) => setRegCode(e.target.value)}
                  placeholder="6 位短信验证码"
                  maxLength={6}
                  required
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ whiteSpace: "nowrap" }}
                  onClick={() => handleSendCode(regPhone.trim(), "register")}
                  disabled={regCountdown > 0}
                >
                  {regCountdown > 0 ? `${regCountdown}s` : "获取验证码"}
                </button>
              </div>
            </div>
            <div className="field">
              <label className="field-label">
                邀请码 <span className="opt">(选填)</span>
              </label>
              <input
                className="input"
                type="text"
                value={regInviteCode}
                onChange={(e) => setRegInviteCode(e.target.value.toUpperCase())}
                placeholder="好友的邀请码,双方均获 20 星币"
                maxLength={8}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: 8 }}
              disabled={loading}
            >
              <i className="ti ti-user-plus" style={{ marginRight: 6 }} />
              {loading ? "注册中…" : "注册并登录"}
            </button>
          </form>
        )}

        {/* 微信扫码登录(开发演示模式也显示) */}
        {wechatConfigured && (
          <>
            <div className="auth-divider">或</div>
            <button
              type="button"
              className="btn wechat-btn"
              style={{ width: "100%", background: "var(--panel)" }}
              onClick={handleWechatRedirect}
              disabled={loading}
            >
              <i className="ti ti-brand-wechat" style={{ marginRight: 6 }} />
              微信扫码登录
              {wechatMock && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: 11,
                    color: "var(--text-muted)",
                    fontWeight: 400,
                  }}
                >
                  (演示)
                </span>
              )}
            </button>
          </>
        )}

        {/* 底部 */}
        <div className="auth-foot">
          <Link href="/auth/forgot-password" style={{ color: "var(--brand)", textDecoration: "none", fontSize: "inherit" }}>
            忘记密码?
          </Link>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            登录即同意{" "}
            <Link href="/legal/terms" style={{ color: "var(--brand)" }}>
              用户协议
            </Link>{" "}
            ·{" "}
            <Link href="/legal/privacy" style={{ color: "var(--brand)" }}>
              隐私政策
            </Link>
          </span>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
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
      }
    >
      <LoginForm />
    </Suspense>
  );
}
