import { Suspense } from "react";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { MobileNav } from "@/components/layout/mobile-nav";

function HeaderFallback() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-primary/10 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
          <div className="hidden h-5 w-20 animate-pulse rounded bg-muted sm:block" />
        </div>
        <div className="hidden items-center gap-1 md:flex">
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-14 animate-pulse rounded-md bg-muted" />
        </div>
        <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
      </div>
    </header>
  );
}

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <Footer />
      <Suspense fallback={null}>
        <MobileNav />
      </Suspense>
    </div>
  );
}
