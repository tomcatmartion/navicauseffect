"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * 命盘（ChartRecord）相关 hooks。
 *
 * 数据形状对齐 /api/charts 返回，避免在调用方重复声明类型。
 * 缓存 key 统一用 ['charts', ...] 命名空间，便于一处 invalidate 全部刷新。
 */

export interface ChartSummary {
  id: string;
  identityId: string;
  name: string;
  birthSolarDate: string;
  birthCity: string | null;
  timeIndex: number;
  gender: "MALE" | "FEMALE";
  isPrimary: boolean;
  source: "MANUAL" | "IMPORTED" | "CHAT" | "REPORT";
  note: string | null;
  chartFingerprint: string;
  summary: {
    solarDate: string;
    lunarDate: string;
    mingGongMajorStars: string[];
    shenGongName: string;
    birthGanZhi: string;
    zodiac: string;
    fiveElementsClass: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChartDetail extends ChartSummary {
  chartSnapshot: {
    birthInfo: {
      year: number;
      month: number;
      day: number;
      hour: number;
      gender: "MALE" | "FEMALE";
      solar: boolean;
      trueSolarTimeInfo?: string;
    };
    reading?: Record<string, unknown>;
    stage1?: unknown;
    stage2?: unknown;
    stage3?: unknown;
  };
}

interface ListResponse {
  charts: ChartSummary[];
}

const KEY = ["charts"] as const;

export function useCharts() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await apiClient.get<ListResponse>("/api/charts");
      return res.charts;
    },
  });
}

export function useChart(id: string | null | undefined) {
  return useQuery({
    queryKey: ["charts", id],
    queryFn: async () => {
      const res = await apiClient.get<{ chart: ChartDetail }>(`/api/charts/${id}`);
      return res.chart;
    },
    enabled: !!id,
  });
}

export function useSaveChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      identityId?: string;
      chartData: Record<string, unknown>;
      birthInfo: Record<string, unknown>;
      isPrimary?: boolean;
      source?: string;
      note?: string;
    }) => {
      return apiClient.post<{ chart: ChartSummary; created: boolean }>(
        "/api/charts",
        payload,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<ChartSummary, "name" | "note" | "isPrimary">>;
    }) => {
      return apiClient.patch<{ chart: ChartSummary }>(
        `/api/charts/${id}`,
        patch,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteChart() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/charts/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}
