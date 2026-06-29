"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

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
    <>
      <AdminPageHeader
        icon="ti-message-sms"
        title="短信网关配置"
        desc="配置短信服务商与验证码模板"
      />

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      {saved && (
        <div className="admin-alert success">
          <i className="ti ti-circle-check" />
          <span>配置已保存</span>
        </div>
      )}

      <AdminCard
        icon="ti-settings"
        title="短信服务商配置"
        desc="阿里云 / 腾讯云短信参数"
        style={{ marginBottom: 16 }}
      >
        <div className="field">
          <Label className="field-label">服务商</Label>
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

        <div className="field-row">
          <div className="field">
            <Label className="field-label">AccessKey ID</Label>
            <Input
              value={config.accessKeyId}
              onChange={(e) => setConfig({ ...config, accessKeyId: e.target.value })}
              placeholder="LTAI5t..."
            />
          </div>
          <div className="field">
            <Label className="field-label">AccessKey Secret</Label>
            <Input
              type="password"
              value={config.accessKeySecret}
              onChange={(e) => setConfig({ ...config, accessKeySecret: e.target.value })}
              placeholder="密钥"
            />
          </div>
        </div>

        <div className="field-row">
          <div className="field">
            <Label className="field-label">短信签名</Label>
            <Input
              value={config.signName}
              onChange={(e) => setConfig({ ...config, signName: e.target.value })}
              placeholder="微著"
            />
          </div>
          <div className="field">
            <Label className="field-label">验证码模板 ID</Label>
            <Input
              value={config.templateCode}
              onChange={(e) => setConfig({ ...config, templateCode: e.target.value })}
              placeholder="SMS_123456789"
            />
          </div>
        </div>

        <div className="admin-save-row">
          <Button onClick={handleSave} disabled={saving}>
            <i className="ti ti-device-floppy" />
            {saving ? "保存中..." : "保存配置"}
          </Button>
          {saved && (
            <span className="admin-save-hint">
              <i className="ti ti-check" />
              已保存
            </span>
          )}
        </div>
      </AdminCard>

      <AdminCard icon="ti-info-circle" title="配置说明">
        <div className="help-note">
          <p>1. <b>阿里云短信</b>：需在阿里云控制台创建 AccessKey，并申请短信签名和模板。</p>
          <p style={{ marginTop: 6 }}>2. <b>腾讯云短信</b>：需在腾讯云控制台创建 SecretId/SecretKey，并申请签名和模板。</p>
          <p style={{ marginTop: 6 }}>3. 验证码模板内容示例：您的验证码为 $&#123;code&#125;，5 分钟内有效。</p>
        </div>
      </AdminCard>
    </>
  );
}
