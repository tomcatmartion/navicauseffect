/**
 * 首页（登录态切换）
 * 对应 H5 端 src/app/(main)/page.tsx
 */
import { View, Text, Image } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "@/services/api";
import "./index.scss";

interface UserProfile {
  id: string;
  name: string;
  membershipPlan: string;
  totalPoints: number;
}

export default function IndexPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);

  useDidShow(() => {
    const token = Taro.getStorageSync("auth_token");
    if (!token) return;
    api
      .get<{ profile: UserProfile }>("/api/user/profile")
      .then((res) => setProfile(res.profile))
      .catch(() => {
        /* 未登录或网络错误 */
      });
  });

  const goLogin = () => Taro.navigateTo({ url: "/pages/chat/chat" }); // chat 页会处理登录

  if (!profile) {
    return (
      <View className="hero">
        <Text className="hero-title">观己观人观世界</Text>
        <Text className="hero-title">知微知著知真如</Text>
        <Text className="hero-desc">
          古老的紫微斗数解码生命轨迹，现代心理科学洞察情绪密码。
        </Text>
        <View className="hero-cta" onClick={() => Taro.switchTab({ url: "/pages/chat/chat" })}>
          立即排盘
        </View>
      </View>
    );
  }

  return (
    <View className="home">
      <View className="greeting card">
        <Text className="greeting-title">欢迎回来，{profile.name}</Text>
        <Text className="greeting-sub">
          {profile.membershipPlan} · {profile.totalPoints} 星币
        </Text>
      </View>

      <View className="quick-grid">
        <View
          className="quick-item card"
          onClick={() => Taro.switchTab({ url: "/pages/chat/chat" })}
        >
          <Text className="quick-icon">🪐</Text>
          <Text className="quick-title">新建排盘</Text>
        </View>
        <View
          className="quick-item card"
          onClick={() => Taro.switchTab({ url: "/pages/charts/charts" })}
        >
          <Text className="quick-icon">📋</Text>
          <Text className="quick-title">我的命盘</Text>
        </View>
        <View
          className="quick-item card"
          onClick={() => Taro.switchTab({ url: "/pages/reports/reports" })}
        >
          <Text className="quick-icon">📄</Text>
          <Text className="quick-title">命理报告</Text>
        </View>
        <View
          className="quick-item card"
          onClick={() => Taro.switchTab({ url: "/pages/profile/profile" })}
        >
          <Text className="quick-icon">👤</Text>
          <Text className="quick-title">个人中心</Text>
        </View>
      </View>
    </View>
  );
}
