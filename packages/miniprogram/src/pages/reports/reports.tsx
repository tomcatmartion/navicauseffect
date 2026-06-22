/** 报告列表页 · 对应 H5 /reports */
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "@/services/api";
import "./reports.scss";

interface Report {
  id: string;
  status: string;
  progress: number;
  templateId: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "排队中",
  GENERATING: "生成中",
  COMPLETED: "已完成",
  FAILED: "失败",
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    api
      .get<{ reports: Report[] }>("/api/reports")
      .then((res) => setReports(res.reports || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  });

  if (loading) return <View className="loading"><Text>加载中...</Text></View>;

  return (
    <ScrollView scrollY className="page">
      <View className="header">
        <Text className="title">命理报告</Text>
      </View>

      {reports.length === 0 ? (
        <View className="empty card">
          <Text>暂无报告</Text>
          <Text className="hint">在命盘页生成报告后会显示在这里</Text>
        </View>
      ) : (
        reports.map((r) => (
          <View key={r.id} className="report-item card">
            <View className="rinfo">
              <Text className="rname">报告 #{r.templateId.slice(0, 6)}</Text>
              <Text className="rmeta">
                {new Date(r.createdAt).toLocaleString("zh-CN")}
              </Text>
            </View>
            <View className={`rstatus status-${r.status.toLowerCase()}`}>
              <Text>{STATUS_LABELS[r.status] || r.status}</Text>
              {r.status === "GENERATING" && <Text className="progress">{r.progress}%</Text>}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
