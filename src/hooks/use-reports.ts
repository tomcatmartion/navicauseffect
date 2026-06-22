"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * 命理报告（Report）+ 模板（ReportTemplate）相关 hooks。
 */

export interface ReportTemplate {
  id: string;
  name: string;
  slug: string;
  type: "BASIC" | "ADVANCED";
  pointCost: number;
  description?: string | null;
  children?: ReportTemplate[];
}

export interface Report {
  id: string;
  userId: string;
  identityId: string;
  chartRecordId: string;
  templateId: string;
  status: "PENDING" | "GENERATING" | "COMPLETED" | "FAILED";
  progress: number;
  content: string | null;
  parentReportId: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

const REPORTS_KEY = ["reports"] as const;
const TEMPLATES_KEY = ["report-templates"] as const;

export function useReports() {
  return useQuery({
    queryKey: REPORTS_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ reports: Report[] }>("/api/reports");
      return res.reports;
    },
  });
}

export function useReport(id: string | null | undefined) {
  return useQuery({
    queryKey: ["reports", id],
    queryFn: async () => {
      const res = await apiClient.get<{ report: Report }>(`/api/reports/${id}`);
      return res.report;
    },
    enabled: !!id,
    // 报告生成中时频繁刷新（5s）；完成后正常缓存
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "GENERATING" || status === "PENDING") return 5000;
      return false;
    },
  });
}

export function useReportTemplates() {
  return useQuery({
    queryKey: TEMPLATES_KEY,
    queryFn: async () => {
      const res = await apiClient.get<{ templates: ReportTemplate[] }>(
        "/api/report-templates",
      );
      return res.templates;
    },
    staleTime: 10 * 60 * 1000, // 模板变化少，缓存 10 分钟
  });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      chartRecordId: string;
      templateId: string;
      identityId?: string;
      options?: Record<string, unknown>;
    }) => {
      return apiClient.post<{ report: Report }>("/api/reports", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_KEY });
    },
  });
}

export function useDeleteReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/reports/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_KEY });
    },
  });
}
