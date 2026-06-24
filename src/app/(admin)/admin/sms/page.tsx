"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SmsConfig {
  provider: string;
  accessKeyId: string;
  accessKeySecret: string;
  signName: string;
  templateCode: string;
}

const defaultConfig: SmsConfig = {
  provider: "aliyun",
  accessKeyId: "",
  accessKeySecret: "",
  signName: "",
  templateCode: "",
};

export default function SmsConfigPage() {
  const [config, setConfig] = useState<SmsConfig>(defaultConfig);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config?key=sms_gateway");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      if (data && typeof data === "object" && data.provider) {
        setConfig(data as SmsConfig);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "sms_gateway", value: config }),
      });
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <i className="ti ti-message-sms text-xl" style={{ color: "var(--brand)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold">短信网关配置</h2>
          <p className="text-xs text-muted-foreground mt-0.5">配置短信服务商与验证码模板</p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--soft)" }}
            >
              <i className="ti ti-settings" style={{ fontSize: 18, color: "var(--brand)" }} />
            </div>
            <div>
              <CardTitle className="text-base">短信服务商配置</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">阿里云 / 腾讯云短信参数</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>服务商</Label>
            <Select
              value={config.provider}
              onValueChange={(v) => setConfig({ ...config, provider: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="aliyun">阿里云短信</SelectItem>
                <SelectItem value="tencent">腾讯云短信</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>AccessKey ID</Label>
              <Input
                value={config.accessKeyId}
                onChange={(e) => setConfig({ ...config, accessKeyId: e.target.value })}
                placeholder="LTAI5t..."
              />
            </div>
            <div className="space-y-2">
              <Label>AccessKey Secret</Label>
              <Input
                type="password"
                value={config.accessKeySecret}
                onChange={(e) => setConfig({ ...config, accessKeySecret: e.target.value })}
                placeholder="密钥"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>短信签名</Label>
              <Input
                value={config.signName}
                onChange={(e) => setConfig({ ...config, signName: e.target.value })}
                placeholder="微著"
              />
            </div>
            <div className="space-y-2">
              <Label>验证码模板 ID</Label>
              <Input
                value={config.templateCode}
                onChange={(e) => setConfig({ ...config, templateCode: e.target.value })}
                placeholder="SMS_123456789"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "保存中..." : "保存配置"}
            </Button>
            {saved && <span className="text-sm text-emerald-600">已保存</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ background: "var(--soft)" }}
            >
              <i className="ti ti-info-circle" style={{ fontSize: 18, color: "var(--brand)" }} />
            </div>
            <CardTitle className="text-base">配置说明</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>1. 阿里云短信：需在阿里云控制台创建 AccessKey，并申请短信签名和模板。</p>
          <p>2. 腾讯云短信：需在腾讯云控制台创建 SecretId/SecretKey，并申请签名和模板。</p>
          <p>3. 验证码模板内容示例：您的验证码为 $&#123;code&#125;，5分钟内有效。</p>
        </CardContent>
      </Card>
    </div>
  );
}
