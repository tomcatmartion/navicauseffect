"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/chart";
  const wechatCode = searchParams.get("wechat_code");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [smsSent, setSmsSent] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regNickname, setRegNickname] = useState("");

  const [wechatConfigured, setWechatConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/wechat")
      .then((r) => r.json())
      .then((data) => setWechatConfigured(data.configured ?? false))
      .catch(() => setWechatConfigured(false));
  }, []);

  const handleWechatLogin = useCallback(
    async (code: string) => {
      setLoading(true);
      setError("");
      const result = await signIn("wechat", { code, redirect: false });
      setLoading(false);
      if (result?.error) {
        setError("微信登录失败，请重试");
      } else {
        window.location.href = callbackUrl;
      }
    },
    [callbackUrl]
  );

  useEffect(() => {
    if (wechatCode) {
      handleWechatLogin(wechatCode);
    }
  }, [wechatCode, handleWechatLogin]);

  const handleUsernameLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("credentials", {
      username: username.trim(),
      password: password.trim(),
      callbackUrl,
      redirect: false,
    });

    setLoading(false);
    // Auth.js：须用 ok 判断成功；仅看 error 可能在部分失败形态下误判
    if (result?.ok) {
      window.location.href = callbackUrl;
      return;
    }
    setError(
      result?.error === "CredentialsSignin"
        ? "用户名或密码错误"
        : (result?.error ? String(result.error) : "登录失败，请稍后重试"),
    );
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await signIn("phone", {
      phone,
      code: smsCode,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      setError("验证码错误或已过期");
    } else {
      window.location.href = callbackUrl;
    }
  };

  const handleSendSms = async () => {
    if (!phone || phone.length !== 11) {
      setError("请输入正确的手机号");
      return;
    }
    setSmsSent(true);
    // TODO: call SMS API
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername,
          password: regPassword,
          nickname: regNickname,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      const result = await signIn("credentials", {
        username: regUsername.trim(),
        password: regPassword.trim(),
        callbackUrl,
        redirect: false,
      });

      setLoading(false);
      if (result?.ok) {
        window.location.href = callbackUrl;
      } else {
        setError(result?.error ? String(result.error) : "自动登录失败，请手动登录");
      }
    } catch {
      setError("注册失败，请稍后重试");
      setLoading(false);
    }
  };

  const handleWechatRedirect = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/wechat");
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError("微信登录未配置，请联系管理员");
        setLoading(false);
      }
    } catch {
      setError("微信登录暂不可用");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md border-primary/15">
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl text-primary-foreground">
          ☯
        </div>
        <CardTitle className="font-[var(--font-serif-sc)] text-2xl text-primary">
          微著
        </CardTitle>
        <p className="text-sm text-muted-foreground">观己观人观世界</p>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Tabs defaultValue="account">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="account" className="flex-1">账号登录</TabsTrigger>
            <TabsTrigger value="phone" className="flex-1">手机登录</TabsTrigger>
            <TabsTrigger value="register" className="flex-1">注册</TabsTrigger>
          </TabsList>

          <TabsContent value="account">
            <form onSubmit={handleUsernameLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>用户名</Label>
                <Input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  required
                  className="border-primary/20"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="phone">
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div className="space-y-2">
                <Label>手机号</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="请输入手机号"
                  maxLength={11}
                  required
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>验证码</Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value)}
                    placeholder="请输入验证码"
                    maxLength={6}
                    required
                    className="border-primary/20"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendSms}
                    disabled={smsSent}
                    className="shrink-0 border-primary/20"
                  >
                    {smsSent ? "已发送" : "获取验证码"}
                  </Button>
                </div>
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "登录中..." : "登录"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label>用户名 <span className="text-xs text-muted-foreground">（3-20位字母、数字或下划线）</span></Label>
                <Input
                  type="text"
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  placeholder="请设置用户名"
                  required
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>昵称 <span className="text-xs text-muted-foreground">（选填，用于展示）</span></Label>
                <Input
                  value={regNickname}
                  onChange={(e) => setRegNickname(e.target.value)}
                  placeholder="给自己起个名字"
                  className="border-primary/20"
                />
              </div>
              <div className="space-y-2">
                <Label>密码</Label>
                <Input
                  type="password"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  placeholder="至少6位密码"
                  minLength={6}
                  required
                  className="border-primary/20"
                />
              </div>
              <Button
                type="submit"
                className="w-full bg-primary hover:bg-primary/90"
                disabled={loading}
              >
                {loading ? "注册中..." : "注册"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        {wechatConfigured && (
          <div className="mt-5 border-t pt-5">
            <p className="mb-3 text-center text-xs text-muted-foreground">其他登录方式</p>
            <Button
              variant="outline"
              className="w-full gap-2 border-green-200 text-green-700 hover:bg-green-50 hover:text-green-800"
              onClick={handleWechatRedirect}
              disabled={loading}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 0 1 .213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 0 0 .167-.054l1.903-1.114a.864.864 0 0 1 .717-.098 10.16 10.16 0 0 0 2.837.403c.276 0 .543-.027.811-.05-.857-2.578.157-4.972 1.932-6.446 1.703-1.415 3.882-1.98 5.853-1.838-.576-3.583-4.196-6.348-8.596-6.348zM5.785 5.991c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178A1.17 1.17 0 0 1 4.623 7.17c0-.651.52-1.18 1.162-1.18zm5.813 0c.642 0 1.162.529 1.162 1.18a1.17 1.17 0 0 1-1.162 1.178 1.17 1.17 0 0 1-1.162-1.178c0-.651.52-1.18 1.162-1.18zm5.34 2.867c-1.797-.052-3.746.512-5.28 1.786-1.72 1.428-2.687 3.72-1.78 6.22.942 2.453 3.666 4.229 6.884 4.229.826 0 1.622-.12 2.361-.336a.722.722 0 0 1 .598.082l1.584.926a.272.272 0 0 0 .14.047c.134 0 .24-.111.24-.247 0-.06-.023-.12-.038-.177l-.327-1.233a.582.582 0 0 1-.023-.156.49.49 0 0 1 .201-.398C23.024 18.48 24 16.82 24 14.98c0-3.21-2.931-5.837-7.062-6.122zm-2.18 2.769c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982zm4.825 0c.535 0 .969.44.969.982a.976.976 0 0 1-.969.983.976.976 0 0 1-.969-.983c0-.542.434-.982.97-.982z"/>
              </svg>
              微信扫码登录
            </Button>
          </div>
        )}

        <div className="mt-4 text-center">
          <Link href="/" className="text-xs text-muted-foreground hover:text-primary">
            返回首页
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary/5 to-background px-4">
      <Suspense
        fallback={
          <div className="flex h-96 w-full max-w-md items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </div>
  );
}
