"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";

interface WechatPayConfig {
  mchId: string;
  appId: string;
  apiKey: string;
  certSerialNo: string;
  notifyUrl: string;
}

interface AlipayConfig {
  appId: string;
  privateKey: string;
  alipayPublicKey: string;
  notifyUrl: string;
}

const defaultWechat: WechatPayConfig = {
  mchId: "",
  appId: "",
  apiKey: "",
  certSerialNo: "",
  notifyUrl: "",
};

const defaultAlipay: AlipayConfig = {
  appId: "",
  privateKey: "",
  alipayPublicKey: "",
  notifyUrl: "",
};

export default function PaymentConfigPage() {
  const [wechat, setWechat] = useState<WechatPayConfig>(defaultWechat);
  const [alipay, setAlipay] = useState<AlipayConfig>(defaultAlipay);
  const [savingWechat, setSavingWechat] = useState(false);
  const [savingAlipay, setSavingAlipay] = useState(false);
  const [savedWechat, setSavedWechat] = useState(false);
  const [savedAlipay, setSavedAlipay] = useState(false);
  const [error, setError] = useState("");

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/config");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      if (data.wechat_pay && typeof data.wechat_pay === "object") {
        setWechat(data.wechat_pay as WechatPayConfig);
      }
      if (data.alipay && typeof data.alipay === "object") {
        setAlipay(data.alipay as AlipayConfig);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "未知错误");
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = async (
    key: string,
    value: unknown,
    setLoading: (v: boolean) => void,
    setSaved: (v: boolean) => void
  ) => {
    setLoading(true);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) throw new Error("保存失败");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <AdminPageHeader
        icon="ti-credit-card"
        title="支付配置"
        desc="微信支付与支付宝接口参数配置"
      />

      {error && (
        <div className="admin-alert error">
          <i className="ti ti-alert-circle" />
          <span>{error}</span>
        </div>
      )}

      <AdminCard
        icon="ti-brand-wechat"
        iconColor="#07c160"
        title="微信支付 V3"
        desc="商户号、AppID、API V3 密钥与回调"
        style={{ marginBottom: 16 }}
      >
        <div className="field-row">
          <div className="field">
            <Label className="field-label">商户号 (mch_id)</Label>
            <Input
              value={wechat.mchId}
              onChange={(e) => setWechat({ ...wechat, mchId: e.target.value })}
              placeholder="1234567890"
            />
          </div>
          <div className="field">
            <Label className="field-label">公众号 AppID</Label>
            <Input
              value={wechat.appId}
              onChange={(e) => setWechat({ ...wechat, appId: e.target.value })}
              placeholder="wx..."
            />
          </div>
        </div>
        <div className="field-row">
          <div className="field">
            <Label className="field-label">API V3 密钥</Label>
            <Input
              type="password"
              value={wechat.apiKey}
              onChange={(e) => setWechat({ ...wechat, apiKey: e.target.value })}
              placeholder="32 位密钥"
            />
          </div>
          <div className="field">
            <Label className="field-label">证书序列号</Label>
            <Input
              value={wechat.certSerialNo}
              onChange={(e) => setWechat({ ...wechat, certSerialNo: e.target.value })}
              placeholder="证书序列号"
            />
          </div>
        </div>
        <div className="field">
          <Label className="field-label">回调通知 URL</Label>
          <Input
            value={wechat.notifyUrl}
            onChange={(e) => setWechat({ ...wechat, notifyUrl: e.target.value })}
            placeholder="https://yourdomain.com/api/payment/callback"
          />
        </div>
        <div className="admin-save-row">
          <Button
            onClick={() => saveConfig("wechat_pay", wechat, setSavingWechat, setSavedWechat)}
            disabled={savingWechat}
          >
            <i className="ti ti-device-floppy" />
            {savingWechat ? "保存中..." : "保存微信配置"}
          </Button>
          {savedWechat && (
            <span className="admin-save-hint">
              <i className="ti ti-check" />
              已保存
            </span>
          )}
        </div>
      </AdminCard>

      <AdminCard
        icon="ti-credit-card"
        iconColor="#1677ff"
        title="支付宝开放平台"
        desc="应用 AppID、私钥、公钥与回调"
      >
        <div className="field">
          <Label className="field-label">应用 AppID</Label>
          <Input
            value={alipay.appId}
            onChange={(e) => setAlipay({ ...alipay, appId: e.target.value })}
            placeholder="2021..."
          />
        </div>
        <div className="field">
          <Label className="field-label">应用私钥</Label>
          <Input
            type="password"
            value={alipay.privateKey}
            onChange={(e) => setAlipay({ ...alipay, privateKey: e.target.value })}
            placeholder="MIIEvQIBADANBg..."
          />
        </div>
        <div className="field">
          <Label className="field-label">支付宝公钥</Label>
          <Input
            type="password"
            value={alipay.alipayPublicKey}
            onChange={(e) => setAlipay({ ...alipay, alipayPublicKey: e.target.value })}
            placeholder="MIIBIjANBg..."
          />
        </div>
        <div className="field">
          <Label className="field-label">回调通知 URL</Label>
          <Input
            value={alipay.notifyUrl}
            onChange={(e) => setAlipay({ ...alipay, notifyUrl: e.target.value })}
            placeholder="https://yourdomain.com/api/payment/callback"
          />
        </div>
        <div className="admin-save-row">
          <Button
            onClick={() => saveConfig("alipay", alipay, setSavingAlipay, setSavedAlipay)}
            disabled={savingAlipay}
          >
            <i className="ti ti-device-floppy" />
            {savingAlipay ? "保存中..." : "保存支付宝配置"}
          </Button>
          {savedAlipay && (
            <span className="admin-save-hint">
              <i className="ti ti-check" />
              已保存
            </span>
          )}
        </div>
      </AdminCard>
    </>
  );
}
