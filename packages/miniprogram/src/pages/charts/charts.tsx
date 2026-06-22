/** 命盘列表页 · 对应 H5 /charts */
import { View, Text, ScrollView } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { api } from "@/services/api";
import "./charts.scss";

interface ChartItem {
  id: string;
  name: string;
  isPrimary: boolean;
  source: string;
  summary: { mingGongMajorStars: string[]; birthGanZhi: string } | null;
}

export default function ChartsPage() {
  const [charts, setCharts] = useState<ChartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    api
      .get<{ charts: ChartItem[] }>("/api/charts")
      .then((res) => setCharts(res.charts || []))
      .catch(() => Taro.showToast({ title: "加载失败", icon: "none" }))
      .finally(() => setLoading(false));
  });

  const goChat = (id: string) =>
    Taro.switchTab({ url: "/pages/chat/chat" }); // TODO: 传 chartRecordId

  if (loading) {
    return (
      <View className="loading">
        <Text>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView scrollY className="page">
      <View className="header">
        <Text className="title">我的命盘</Text>
        <Text className="meta">{charts.length} 张</Text>
      </View>

      {charts.length === 0 ? (
        <View className="empty card">
          <Text>还没有保存的命盘</Text>
          <Text className="hint">在对话页排盘后可保存</Text>
        </View>
      ) : (
        charts.map((chart) => (
          <View key={chart.id} className="chart-item card" onClick={() => goChat(chart.id)}>
            <View className={`thumb ${chart.isPrimary ? "primary" : ""}`}>
              <Text>{chart.isPrimary ? "★" : chart.name.charAt(0)}</Text>
            </View>
            <View className="info">
              <Text className="name">
                {chart.name}
                {chart.isPrimary && <Text className="badge">默认</Text>}
              </Text>
              <Text className="meta">
                {chart.summary
                  ? `命宫 ${chart.summary.mingGongMajorStars.join("·")} · ${chart.summary.birthGanZhi}`
                  : chart.source}
              </Text>
            </View>
            <View className="action">
              <Text className="action-icon">▸</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}
