import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    title: "命理排盘",
    desc: "基于紫微斗数精准排盘，生成命盘、大限盘、流年盘，支持阴历/阳历与真太阳时自动校正",
    icon: "☯",
  },
  {
    title: "AI 智能解析",
    desc: "四大顶尖 AI 大模型深度解读命盘，融合紫微智慧与心理学视角，给出全方位分析",
    icon: "🧠",
  },
  {
    title: "性格分析",
    desc: "从命宫主星解读你的性格密码，结合大五人格理论，帮助你更好地认识自己",
    icon: "🔮",
  },
  {
    title: "感情婚姻",
    desc: "夫妻宫与桃花星深度分析，结合依恋理论，为你的感情生活提供温暖指引",
    icon: "💕",
  },
  {
    title: "事业财运",
    desc: "官禄宫与财帛宫联合解读，结合职业心理学，助你找到事业发展最优路径",
    icon: "📈",
  },
  {
    title: "情绪疏导",
    desc: "福德宫分析内在情绪模式，融合认知行为疗法，提供专业的心理疏导建议",
    icon: "🌿",
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-4xl px-4 py-20 text-center md:py-32">
          <p className="mb-4 text-sm tracking-[0.3em] text-accent-foreground/60">
            传统智慧 × 现代科学
          </p>
          <h1 className="mb-2 font-[var(--font-serif-sc)] text-4xl font-bold leading-tight text-primary md:text-6xl">
            观己观人观世界
          </h1>
          <h2 className="mb-8 font-[var(--font-serif-sc)] text-4xl font-bold leading-tight text-primary md:text-6xl">
            知微知著知真如
          </h2>
          <p className="mx-auto mb-10 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            古老的紫微斗数解码生命轨迹，现代心理科学洞察情绪密码。
            透过星盘与数据，提供经过双重验证的人生优化方案，
            助你以更清晰的认知与更积极的心态，把握美好生活的主动权。
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/chart">
              <Button size="lg" className="bg-primary px-8 text-lg hover:bg-primary/90">
                立即排盘
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-primary/30 px-8 text-lg text-primary">
                了解会员
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 md:py-24">
        <div className="mb-12 text-center">
          <h2 className="mb-3 font-[var(--font-serif-sc)] text-2xl font-bold text-primary md:text-3xl">
            核心服务
          </h2>
          <p className="text-muted-foreground">
            从命理智慧到心理科学，全方位守护你的人生旅程
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card
              key={f.title}
              className="group border-primary/10 transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
            >
              <CardContent className="p-6">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl transition-transform group-hover:scale-110">
                  {f.icon}
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {f.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-primary/5 to-accent/10">
        <div className="mx-auto max-w-4xl px-4 py-16 text-center md:py-24">
          <h2 className="mb-4 font-[var(--font-serif-sc)] text-2xl font-bold text-primary md:text-3xl">
            开启你的自我探索之旅
          </h2>
          <p className="mb-8 text-muted-foreground">
            无需付费，即刻体验紫微排盘与 AI 智能解析
          </p>
          <Link href="/chart">
            <Button size="lg" className="bg-primary px-10 text-lg hover:bg-primary/90">
              免费体验
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
