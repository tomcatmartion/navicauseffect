/**
 * AI 对话页（命盘抽屉 + WebSocket 流式）
 * 对应 H5 端 src/app/(main)/chart/page.tsx
 *
 * 关键改造点（见 testUI/miniprogram/SPEC.md §3.1）：
 *  - SSE → WebSocket（src/services/chat-stream.ts）
 *  - 命盘抽屉 → page-container
 *  - textarea → auto-height + 键盘弹起处理
 *  - 消息流 → scroll-view scroll-into-view
 */
import { View, Text, Textarea, ScrollView, Picker, Button } from "@tarojs/components";
import { useState, useRef } from "react";
import { openChatStream } from "@/services/chat-stream";
import "./chat.scss";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const MODELS = ["MiniMax v1", "DeepSeek V3", "智谱 GLM-4", "通义千问 Max", "Claude Sonnet"];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [model, setModel] = useState(MODELS[0]);
  const scrollRef = useRef("");

  const handleSend = () => {
    if (!input.trim() || streaming) return;
    const question = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    setStreaming(true);

    const stream = openChatStream(
      { question, chartData: undefined /* TODO: 用户选命盘后注入 */ },
      {
        onMessage: (text) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return [...prev.slice(0, -1), { role: "assistant", content: last.content + text }];
            }
            return [...prev, { role: "assistant", content: text }];
          });
          scrollRef.current = `msg-${Date.now()}`;
        },
        onError: (err) => {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `[错误] ${err.message}` },
          ]);
          setStreaming(false);
        },
        onClose: () => setStreaming(false),
      },
    );

    return () => stream.close();
  };

  return (
    <View className="chat-page">
      {/* 顶栏 */}
      <View className="topbar">
        <Text className="topbar-title">AI 对话</Text>
        <Picker
          mode="selector"
          range={MODELS}
          onChange={(e) => setModel(MODELS[Number(e.detail.value)])}
        >
          <View className="model-picker">
            <Text>{model}</Text>
            <Text className="caret">▾</Text>
          </View>
        </Picker>
      </View>

      {/* 消息列表 */}
      <ScrollView
        className="msg-list"
        scrollY
        scrollIntoView={scrollRef.current}
        enhanced
        showScrollbar={false}
      >
        {messages.length === 0 && (
          <View className="empty">
            <Text>输入你的命理问题开始对话</Text>
          </View>
        )}
        {messages.map((msg, i) => (
          <View key={i} className={`msg msg-${msg.role}`}>
            <View className="msg-avatar">{msg.role === "assistant" ? "紫" : "我"}</View>
            <View className="msg-bubble">
              <Text selectable>{msg.content}</Text>
            </View>
          </View>
        ))}
        <View id={`msg-${Date.now()}`} />
      </ScrollView>

      {/* 输入区 */}
      <View className="composer">
        <Textarea
          className="composer-input"
          value={input}
          onInput={(e) => setInput(e.detail.value)}
          placeholder="输入你的命理问题..."
          autoHeight
          disabled={streaming}
          adjustPosition
        />
        <Button
          className="composer-send"
          onClick={handleSend}
          disabled={streaming || !input.trim()}
        >
          发送
        </Button>
      </View>
    </View>
  );
}
