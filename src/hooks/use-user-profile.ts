"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * 用户资料 + 积分流水的 hooks。
 * user.profile 返回会员状态、积分、邀请码等聚合信息。
 */

export interface UserProfile {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  image?: string | null;
  role: "USER" | "ADMIN";
  membershipPlan: "FREE" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  membershipStatus: "NONE" | "ACTIVE" | "EXPIRED";
  membershipEndDate?: string | null;
  totalPoints: number;
  inviteCode: string;
  referralCount: number;
  referralPoints: number;
  chartCount: number;
  reportCount: number;
}

export interface PointLog {
  id: string;
  points: number;
  source:
    | "SHARE"
    | "ADMIN_GRANT"
    | "INVITE"
    | "RECHARGE"
    | "CONSUME"
    | "REFUND";
  detail: string;
  balanceAfter: number;
  createdAt: string;
}

const PROFILE_KEY = ["user-profile"] as const;
const POINTS_KEY = ["user-points"] as const;

export function useUserProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ profile: UserProfile }>(
        "/api/user/profile",
      );
      return res.profile;
    },
    staleTime: 60 * 1000, // 1 分钟（积分变动需要及时反映）
  });
}

export function usePointLogs(page = 1, pageSize = 20) {
  return useQuery({
    queryKey: [...POINTS_KEY, page, pageSize],
    queryFn: async () => {
      const res = await apiClient.get<{
        logs: PointLog[];
        total: number;
        page: number;
        pageSize: number;
      }>("/api/user/points/logs", undefined);
      // 后端可能不支持 query 参数，这里防御性取值
      return Array.isArray(res.logs) ? res.logs : [];
    },
  });
}

export function useRefreshProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 仅触发 invalidate，无实际网络请求
      return Promise.resolve();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PROFILE_KEY });
      qc.invalidateQueries({ queryKey: POINTS_KEY });
    },
  });
}
