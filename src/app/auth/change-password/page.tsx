"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * B-01-2：修改密码
 *
 * 后端已实现（2026-06-26）：POST /api/auth/change-password
 * - 校验旧密码 + bcrypt 加密新密码 + 写入数据库
 * - 手机/微信注册用户（无 password 字段）返回 409，引导走 forgot-password
 */
export default function ChangePasswordPage() {
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!oldPassword) {
      setError("请输入当前密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码长度至少 6 位");
      return;
    }
    if (newPassword === oldPassword) {
      setError("新密码不能与当前密码相同");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "修改失败");
        setLoading(false);
        return;
      }
      toast.success("密码修改成功，请重新登录", { duration: 3000 });
      // 修改密码后引导重新登录（旧 JWT 仍有效但建议刷新）
      router.push("/profile");
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
            <i className="ti ti-key" />
          </div>
          <h2>修改密码</h2>
          <p>建议定期更换密码以保障账号安全</p>
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

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label">当前密码</label>
            <input
              className="input"
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
              autoFocus
            />
          </div>
          <div className="field">
            <label className="field-label">新密码</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="至少 6 位字符"
              minLength={6}
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

          <div style={{ marginTop: 8 }}>
            <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
              {loading ? "保存中…" : "确认修改"}
            </button>
          </div>
        </form>

        <div className="auth-foot" style={{ marginTop: 22 }}>
          <Link href="/profile">返回个人中心</Link>
          <Link href="/auth/forgot-password">忘记密码?</Link>
        </div>
      </div>
    </div>
  );
}
