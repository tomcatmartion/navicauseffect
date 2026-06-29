"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

/**
 * S-01：新用户首次登录 Onboarding 引导
 *
 * 触发逻辑（在首页）：
 *   - 已登录 + localStorage 缺失 onboardingCompleted 标记
 *   - 渲染 <OnboardingDialog open onComplete={...} />
 *
 * 3 步引导：
 *   1. 填写命主资料（名字、性别、出生信息）
 *   2. 排盘并保存到命盘库
 *   3. 开启 AI 对话深度解读
 *
 * 设计要点：
 *   - 不强制看完，可随时「跳过」并写入 localStorage
 *   - 每步含 icon + 标题 + 简述 + CTA（直达对应页面）
 *   - CTA 点击后关闭弹层并写 localStorage（视为完成）
 */

const ONBOARDING_KEY = "zw-onboarding-completed";

export function isOnboardingCompleted(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_KEY) === "1";
}

export function markOnboardingCompleted(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_KEY, "1");
}

interface Step {
  icon: string;
  title: string;
  desc: string;
  ctaLabel: string;
  ctaHref: string;
}

const STEPS: Step[] = [
  {
    icon: "ti-user-plus",
    title: "1 / 3 · 创建命主档案",
    desc: "命主是命理分析的对象。先填写姓名、性别、出生城市等信息，后续排盘 / 报告 / 合盘都会用到。",
    ctaLabel: "去创建命主",
    ctaHref: "/user",
  },
  {
    icon: "ti-spiral",
    title: "2 / 3 · 排盘并保存",
    desc: "输入出生时间排出紫微斗数命盘（首盘免费）。排盘后点击「保存为命盘」即可永久存到命盘库，方便随时回看。",
    ctaLabel: "去排盘",
    ctaHref: "/chart",
  },
  {
    icon: "ti-message-2",
    title: "3 / 3 · 开启 AI 对话",
    desc: "在命盘页直接向 AI 提问事业 / 财运 / 婚恋等任何问题，融合紫微智慧与心理学视角的全方位解读。会员可无限对话。",
    ctaLabel: "体验 AI 对话",
    ctaHref: "/chart",
  },
];

interface OnboardingDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function OnboardingDialog({ open, onComplete }: OnboardingDialogProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const close = () => {
    markOnboardingCompleted();
    setStep(0);
    onComplete();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) close();
      }}
    >
      <DialogContent className="paywall-dialog" style={{ maxWidth: 460 }}>
        <DialogHeader>
          <DialogTitle style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <i className={`ti ${current.icon}`} style={{ color: "var(--brand)" }} />
            <span style={{ fontFamily: "var(--font-head)" }}>{current.title}</span>
          </DialogTitle>
          <DialogDescription style={{ minHeight: 60, lineHeight: 1.8, fontSize: 13 }}>
            {current.desc}
          </DialogDescription>
        </DialogHeader>

        {/* 进度指示器 */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", margin: "8px 0 16px" }}>
          {STEPS.map((_, i) => (
            <span
              key={i}
              style={{
                width: i === step ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === step ? "var(--brand)" : "var(--line)",
                transition: "width .25s",
              }}
            />
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={close}
            style={{ fontSize: 12, color: "var(--text-muted)" }}
          >
            跳过引导
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {step > 0 && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                上一步
              </button>
            )}
            {!isLast ? (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
              >
                下一步
              </button>
            ) : (
              <Link
                href={current.ctaHref}
                className="btn btn-primary btn-sm"
                onClick={close}
              >
                <i className="ti ti-check" /> 完成，去体验
              </Link>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
