"use client";

import { useState } from "react";

interface AnalysisResultProps {
  content: string;
  loading: boolean;
  reasoning?: string;
}

export function AnalysisResult({ content, loading, reasoning }: AnalysisResultProps) {
  const [showReasoning, setShowReasoning] = useState(false);

  if (!content && !reasoning && !loading) return null;

  return (
    <div className="space-y-4">
      {/* 深度思考过程 */}
      {reasoning && (
        <div className="rounded-lg border border-blue-200/60 bg-blue-50/40 dark:border-blue-800/40 dark:bg-blue-950/20">
          <button
            type="button"
            onClick={() => setShowReasoning(!showReasoning)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100/50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            <span className={`transition-transform ${showReasoning ? "rotate-90" : ""}`}>▶</span>
            <span>AI 深度思考过程</span>
            <span className="text-xs text-muted-foreground ml-auto">
              {reasoning.length} 字
            </span>
          </button>
          {showReasoning && (
            <div className="px-3 pb-3 pt-1">
              <div className="prose prose-sm max-w-none text-muted-foreground text-xs leading-relaxed whitespace-pre-wrap">
                {reasoning}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 正文内容 */}
      {content ? (
        <div className="prose prose-sm max-w-none text-foreground">
          {content.split("\n").filter((p) => p.trim()).map((p, i) => {
            if (p.startsWith("##")) {
              return (
                <h3 key={i} className="mb-2 mt-4 font-[var(--font-serif-sc)] text-lg font-semibold text-primary">
                  {p.replace(/^#+\s*/, "")}
                </h3>
              );
            }
            if (p.startsWith("#")) {
              return (
                <h2 key={i} className="mb-3 mt-5 font-[var(--font-serif-sc)] text-xl font-bold text-primary">
                  {p.replace(/^#+\s*/, "")}
                </h2>
              );
            }
            if (p.startsWith("**") && p.endsWith("**")) {
              return (
                <h4 key={i} className="mb-1 mt-3 font-semibold text-primary/80">
                  {p.replace(/\*\*/g, "")}
                </h4>
              );
            }
            return (
              <p key={i} className="mb-2 leading-relaxed text-foreground/80">
                {p}
              </p>
            );
          })}
          {loading && (
            <span className="inline-block h-4 w-1 animate-pulse bg-primary" />
          )}
          {!loading && (
            <div className="mt-6 rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">
              免责声明：本分析仅供参考，旨在帮助您进行自我探索与反思，不构成任何医疗、心理诊断或投资建议。
            </div>
          )}
        </div>
      ) : loading && !reasoning ? (
        <div className="prose prose-sm max-w-none">
          <span className="inline-block h-4 w-1 animate-pulse bg-primary" />
        </div>
      ) : null}
    </div>
  );
}
