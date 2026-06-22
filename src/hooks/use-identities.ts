"use client";

import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

/**
 * 命主（Identity）相关 hooks。
 * 命主是用户的"对象档案"，每个命主可以有多张命盘（ChartRecord）。
 */

export interface Identity {
  id: string;
  userId: string;
  name: string;
  gender: "MALE" | "FEMALE";
  birthday?: string | null;
  birthCity?: string | null;
  region?: string | null;
  relation: string;
  bazi?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ListResponse {
  identities: Identity[];
}

const KEY = ["identities"] as const;

export function useIdentities() {
  return useQuery({
    queryKey: KEY,
    queryFn: async () => {
      const res = await apiClient.get<ListResponse>("/api/identities");
      return res.identities;
    },
  });
}

export function useIdentity(id: string | null | undefined) {
  return useQuery({
    queryKey: ["identities", id],
    queryFn: async () => {
      const res = await apiClient.get<{ identity: Identity }>(
        `/api/identities/${id}`,
      );
      return res.identity;
    },
    enabled: !!id,
  });
}

export function useCreateIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Identity>) => {
      return apiClient.post<{ identity: Identity }>("/api/identities", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Identity>;
    }) => {
      return apiClient.patch<{ identity: Identity }>(
        `/api/identities/${id}`,
        patch,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteIdentity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient.delete(`/api/identities/${id}`);
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY });
      // 命主变了，命盘也要刷新
      qc.invalidateQueries({ queryKey: ["charts"] });
    },
  });
}
