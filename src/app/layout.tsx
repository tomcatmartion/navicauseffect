import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

const notoSerif = localFont({
  src: "../../public/fonts/noto-serif-sc.woff2",
  variable: "--font-serif-sc",
  display: "swap",
  weight: "400 700",
});

const notoSans = localFont({
  src: "../../public/fonts/noto-sans-sc.woff2",
  variable: "--font-sans-sc",
  display: "swap",
  weight: "300 700",
});

export const metadata: Metadata = {
  title: "紫微心理 | 观己观人观世界，知微知著知真如",
  description:
    "以紫微斗数与心理科学相融合，传统智慧指引方向，科学方法疏导心结。提供命理排盘、性格分析、情感咨询等专业服务。",
  keywords: "紫微斗数,命理,心理咨询,性格分析,运势,情感,亲子关系",
  openGraph: {
    title: "紫微心理 | 传统智慧 × 现代科学",
    description: "观己观人观世界，知微知著知真如。紫微斗数与心理科学融合的命理咨询平台。",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body
        className={`${notoSerif.variable} ${notoSans.variable} font-[var(--font-sans-sc)] antialiased`}
      >
        <AuthSessionProvider>
          {children}
        </AuthSessionProvider>
        <Toaster />
      </body>
    </html>
  );
}
