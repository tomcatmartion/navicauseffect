import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-primary/10 bg-muted/30">
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div>
            <h3 className="mb-3 text-lg font-semibold text-primary font-[var(--font-serif-sc)]">
              微著
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              观己观人观世界
              <br />
              知微知著知真如
            </p>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">服务</h4>
            <div className="flex flex-col gap-2 text-sm text-muted-foreground">
              <Link href="/chart" className="hover:text-primary transition-colors">
                命理排盘
              </Link>
              <Link href="/pricing" className="hover:text-primary transition-colors">
                会员服务
              </Link>
            </div>
          </div>
          <div>
            <h4 className="mb-3 text-sm font-semibold">免责声明</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              本平台提供的命理分析和心理建议仅供参考，旨在帮助您进行自我探索与反思，
              不构成任何医疗、心理诊断或投资建议。如有严重心理困扰，请及时寻求专业帮助。
            </p>
          </div>
        </div>
        <div className="mt-8 border-t border-primary/5 pt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} 微著. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
