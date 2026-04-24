"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  role: string;
  totalPoints: number;
  bonusQueries: number;
  inviteCode: string;
  createdAt: string;
  membership: {
    plan: string;
    status: string;
    startDate: string | null;
    endDate: string | null;
  } | null;
  stats: {
    consultations: number;
    orders: number;
    shares: number;
  };
}

const PLAN_LABELS: Record<string, string> = {
  FREE: "普通用户",
  MONTHLY: "月度会员",
  QUARTERLY: "季度会员",
  YEARLY: "年度会员",
};

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [newNickname, setNewNickname] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
      return;
    }
    if (status === "authenticated") {
      fetchProfile();
    }
  }, [status, router]);

  const fetchProfile = async () => {
    try {
      const res = await fetch("/api/user/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setNewNickname(data.nickname || "");
      }
    } catch {
      toast.error("加载个人信息失败");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateNickname = async () => {
    if (!newNickname.trim()) {
      toast.error("昵称不能为空");
      return;
    }
    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: newNickname.trim() }),
      });
      if (res.ok) {
        toast.success("昵称已更新");
        setEditing(false);
        fetchProfile();
      } else {
        const data = await res.json();
        toast.error(data.error || "更新失败");
      }
    } catch {
      toast.error("网络错误");
    }
  };

  const handleCopyInviteCode = () => {
    if (profile?.inviteCode) {
      navigator.clipboard.writeText(profile.inviteCode);
      toast.success("邀请码已复制");
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const isPremium =
    profile.membership?.plan === "MONTHLY" ||
    profile.membership?.plan === "QUARTERLY" ||
    profile.membership?.plan === "YEARLY";

  const membershipExpired =
    profile.membership?.endDate &&
    new Date(profile.membership.endDate) < new Date();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 font-[var(--font-serif-sc)] text-2xl font-bold text-primary">
        个人中心
      </h1>

      <Card className="mb-6 border-primary/15">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-xl font-medium text-primary">
                {profile.nickname?.charAt(0) || "U"}
              </div>
              <div>
                {editing ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newNickname}
                      onChange={(e) => setNewNickname(e.target.value)}
                      className="h-8 w-32 border-primary/20 text-sm"
                      maxLength={20}
                    />
                    <Button size="sm" variant="ghost" onClick={handleUpdateNickname} className="h-8 px-2 text-xs">
                      保存
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-8 px-2 text-xs text-muted-foreground">
                      取消
                    </Button>
                  </div>
                ) : (
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {profile.nickname || "未设置昵称"}
                    <button
                      onClick={() => setEditing(true)}
                      className="text-xs text-muted-foreground hover:text-primary"
                    >
                      编辑
                    </button>
                  </CardTitle>
                )}
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={
                      isPremium && !membershipExpired
                        ? "border-amber-400 text-amber-600 text-xs"
                        : "border-primary/30 text-xs"
                    }
                  >
                    {isPremium && !membershipExpired
                      ? PLAN_LABELS[profile.membership!.plan]
                      : membershipExpired
                      ? "会员已过期"
                      : "普通用户"}
                  </Badge>
                  {profile.role === "ADMIN" && (
                    <Badge variant="outline" className="border-red-300 text-red-500 text-xs">
                      管理员
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          {(profile.email || profile.phone) && (
            <p className="mt-2 text-xs text-muted-foreground">
              {profile.email && `邮箱：${profile.email}`}
              {profile.email && profile.phone && " | "}
              {profile.phone && `手机：${profile.phone}`}
            </p>
          )}
        </CardHeader>
      </Card>

      {isPremium && profile.membership?.endDate && (
        <Card className="mb-6 border-amber-200 bg-amber-50/50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {PLAN_LABELS[profile.membership.plan]} · {membershipExpired ? "已过期" : "有效中"}
                </p>
                <p className="text-xs text-amber-600">
                  到期时间：{new Date(profile.membership.endDate).toLocaleDateString("zh-CN")}
                </p>
              </div>
              {membershipExpired && (
                <Link href="/pricing">
                  <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white">
                    续费
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="border-primary/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{profile.totalPoints}</p>
            <p className="text-xs text-muted-foreground">积分</p>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{profile.bonusQueries}</p>
            <p className="text-xs text-muted-foreground">奖励次数</p>
          </CardContent>
        </Card>
        <Card className="border-primary/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{profile.stats.consultations}</p>
            <p className="text-xs text-muted-foreground">排盘次数</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6 border-primary/10">
        <CardHeader>
          <CardTitle className="text-base">邀请好友</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-muted-foreground">
            分享给好友，每次有效分享获得 1 积分，每 10 积分可兑换 1 次免费测算
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-md bg-muted p-2 text-center text-sm font-mono">
              {profile.inviteCode}
            </code>
            <Button
              variant="outline"
              size="sm"
              className="border-primary/20"
              onClick={handleCopyInviteCode}
            >
              复制
            </Button>
          </div>
        </CardContent>
      </Card>

      {!isPremium && (
        <Card className="mb-6 border-primary/10">
          <CardContent className="p-4 text-center">
            <p className="mb-2 text-sm text-muted-foreground">
              升级会员，解锁完整 AI 分析和更多功能
            </p>
            <Link href="/pricing">
              <Button className="bg-primary hover:bg-primary/90">
                查看会员方案
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="mb-6 border-primary/10">
        <CardHeader>
          <CardTitle className="text-base">历史记录</CardTitle>
        </CardHeader>
        <CardContent>
          {profile.stats.consultations > 0 ? (
            <p className="text-sm text-muted-foreground">
              共 {profile.stats.consultations} 次排盘记录
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">暂无排盘记录</p>
          )}
          <Separator className="my-4" />
          <Link href="/chart">
            <Button className="w-full bg-primary hover:bg-primary/90">
              去排盘
            </Button>
          </Link>
        </CardContent>
      </Card>

      <div className="text-center">
        <Button
          variant="ghost"
          className="text-sm text-muted-foreground hover:text-destructive"
          onClick={() => signOut({ callbackUrl: "/" })}
        >
          退出登录
        </Button>
      </div>
    </div>
  );
}
