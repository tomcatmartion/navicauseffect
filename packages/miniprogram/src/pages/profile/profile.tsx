/** 个人中心 · 对应 H5 /profile + /user */
import { View, Text, Button, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api, wechatLogin, requestPayment } from "@/services/api";
import "./profile.scss";

interface Profile {
  id: string;
  name: string;
  membershipPlan: string;
  totalPoints: number;
  inviteCode: string;
  chartCount: number;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useDidShow(() => {
    api
      .get<{ profile: Profile }>("/api/user/profile")
      .then((res) => setProfile(res.profile))
      .catch(() => {});
  });

  const handleLogin = async () => {
    try {
      await wechatLogin();
      const res = await api.get<{ profile: Profile }>("/api/user/profile");
      setProfile(res.profile);
    } catch {
      Taro.showToast({ title: "登录失败", icon: "none" });
    }
  };

  const handleShare = () => {
    // 小程序分享必须用 <Button open-type="share">，这里只是提示
    Taro.showToast({ title: "请点击右上角分享", icon: "none" });
  };

  // 定义分享内容（onShareAppMessage 在 Page 级，Taro React 模式用 useShareAppMessage）
  Taro.useShareAppMessage(() => ({
    title: profile
      ? `${profile.name} 邀你紫微问道`
      : "紫微问道 - AI 智能命理咨询",
    path: `/pages/index/index?ref=${profile?.inviteCode || ""}`,
  }));

  if (!profile) {
    return (
      <View className="login">
        <Text className="title">紫微问道</Text>
        <Text className="desc">登录后查看个人中心</Text>
        <Button className="btn btn-primary" onClick={handleLogin}>
          微信一键登录
        </Button>
      </View>
    );
  }

  return (
    <ScrollView scrollY className="page">
      <View className="user-card card">
        <View className="avatar">
          <Text>{profile.name.charAt(0)}</Text>
        </View>
        <View className="uinfo">
          <Text className="uname">{profile.name}</Text>
          <Text className="uplan">{profile.membershipPlan}</Text>
        </View>
      </View>

      <View className="stats card">
        <View className="stat">
          <Text className="sv">{profile.totalPoints}</Text>
          <Text className="sl">星币</Text>
        </View>
        <View className="stat">
          <Text className="sv">{profile.chartCount}</Text>
          <Text className="sl">命盘</Text>
        </View>
      </View>

      <View className="invite card">
        <Text className="invite-title">邀请好友得星币</Text>
        <Text className="invite-code">邀请码：{profile.inviteCode}</Text>
        <Button className="btn btn-primary" onClick={handleShare}>
          分享给好友
        </Button>
      </View>

      <View className="menu card">
        <View className="menu-item">
          <Text>会员充值</Text>
          <Text className="arrow">▸</Text>
        </View>
        <View className="menu-item" onClick={() => requestPayment("monthly")}>
          <Text>月度会员 ¥29.9</Text>
          <Text className="arrow">▸</Text>
        </View>
        <View className="menu-item" onClick={() => requestPayment("yearly")}>
          <Text>年度会员 ¥299</Text>
          <Text className="arrow">▸</Text>
        </View>
      </View>
    </ScrollView>
  );
}
