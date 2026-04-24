"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── 类型 ───

interface KBFile {
  name: string;
  ext: string;
  size: number;
  modifiedAt: string;
  indexed: boolean;
}

interface IndexProgress {
  status: "idle" | "running" | "completed" | "error";
  totalFiles: number;
  processedFiles: number;
  totalChunks: number;
  processedChunks: number;
  apiCalls1536: number;
  apiCalls1024: number;
  skippedChunks: number;
  currentFile: string;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface RetagLogEntry {
  type: "start" | "file" | "batch" | "chunk" | "done" | "error";
  text: string;
  oldTags?: string[];
  newTags?: string[];
}

interface RetagProgress {
  status: "idle" | "running" | "completed" | "error";
  mode: string;
  type: string;
  model: string;
  totalChunks: number;
  processedChunks: number;
  updatedChunks: number;
  skippedChunks: number;
  aiCalls: number;
  files: number;
  currentFile: string;
  logs: RetagLogEntry[];
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

interface ChunkDetail {
  id: string;
  text: string;
  source_file: string;
  content_hash: string;
  index_version: string;
  biz_modules: string[];
  stars: string[];
  palaces: string[];
  energy_levels: string[];
  time_scopes: string[];
}

// ─── 工具函数 ───

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function extBadgeColor(ext: string): string {
  switch (ext) {
    case ".md": return "bg-green-100 text-green-800";
    case ".docx": return "bg-blue-100 text-blue-800";
    case ".pdf": return "bg-red-100 text-red-800";
    case ".xlsx": case ".xls": return "bg-emerald-100 text-emerald-800";
    default: return "bg-gray-100 text-gray-800";
  }
}

/** 生成分页页码数组（中间省略） */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  let left = Math.max(2, current - 2);
  let right = Math.min(total - 1, current + 2);
  if (current <= 4) { left = 2; right = Math.min(6, total - 1); }
  if (current >= total - 3) { right = total - 1; left = Math.max(total - 5, 2); }
  if (left > 2) pages.push("...");
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < total - 1) pages.push("...");
  pages.push(total);
  return pages;
}

/** 分页控件 */
function PaginationControls({ page, totalPages, onPageChange }: {
  page: number; totalPages: number; onPageChange: (p: number) => void;
}) {
  const [jumpInput, setJumpInput] = useState("");
  const pages = getPageNumbers(page, totalPages);

  const handleJump = () => {
    const n = parseInt(jumpInput, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) {
      onPageChange(n);
      setJumpInput("");
    }
  };

  return (
    <div className="flex items-center gap-1">
      <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => onPageChange(1)}>«</Button>
      <Button size="sm" variant="outline" className="h-7 px-2" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</Button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={"d" + i} className="px-1 text-xs text-muted-foreground">…</span>
        ) : (
          <Button key={p} size="sm" variant={p === page ? "default" : "outline"} className="h-7 min-w-[28px] px-1.5 text-xs" onClick={() => onPageChange(p)}>{p}</Button>
        )
      )}
      <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</Button>
      <Button size="sm" variant="outline" className="h-7 px-2" disabled={page >= totalPages} onClick={() => onPageChange(totalPages)}>»</Button>
      <div className="ml-2 flex items-center gap-1">
        <span className="text-xs text-muted-foreground">跳至</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jumpInput}
          onChange={(e) => setJumpInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJump()}
          className="h-7 w-12 rounded border bg-background px-1.5 text-center text-xs"
          placeholder={String(page)}
        />
        <span className="text-xs text-muted-foreground">页</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={handleJump}>跳转</Button>
      </div>
    </div>
  );
}

// ─── 主组件 ───

export default function KnowledgeBasePage() {
  const [files, setFiles] = useState<KBFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<IndexProgress>({ status: "idle", totalFiles: 0, processedFiles: 0, totalChunks: 0, processedChunks: 0, apiCalls1536: 0, apiCalls1024: 0, skippedChunks: 0, currentFile: "" });

  // 打标进度（轮询模式）
  const [retagProgress, setRetagProgress] = useState<RetagProgress>({ status: "idle", mode: "system", type: "full", model: "", totalChunks: 0, processedChunks: 0, updatedChunks: 0, skippedChunks: 0, aiCalls: 0, files: 0, currentFile: "", logs: [] });
  const retagging = retagProgress.status === "running";

  // 分段详情弹窗状态
  const [chunksFile, setChunksFile] = useState<string | null>(null);
  const [chunks, setChunks] = useState<ChunkDetail[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);
  const [chunksFamily, setChunksFamily] = useState<"1536" | "1024">("1536");
  const [expandedChunk, setExpandedChunk] = useState<string | null>(null);
  const [chunksPage, setChunksPage] = useState(1);
  const chunksPageSize = 20;

  // 标签编辑弹窗状态
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editingTags, setEditingTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // 分段选择状态（用于指定片段重打）
  const [selectedChunkIds, setSelectedChunkIds] = useState<Set<string>>(new Set());

  // 重新打标模式选择对话框
  const [showRetagDialog, setShowRetagDialog] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const indexPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const retagPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ─── 文件列表 ───

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/knowledge-base/list");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast.error("加载文件列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);

  // ─── 向量化进度轮询 ───

  const startIndexPolling = useCallback(() => {
    if (indexPollingRef.current) return;
    indexPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/knowledge-base/index-progress");
        const p: IndexProgress = await res.json();
        setProgress(p);
        if (p.status !== "running") {
          if (indexPollingRef.current) {
            clearInterval(indexPollingRef.current);
            indexPollingRef.current = null;
          }
          if (p.status === "completed") {
            toast.success(`向量化完成！共 ${p.totalChunks} 块，1536 调用 ${p.apiCalls1536} 次，1024 调用 ${p.apiCalls1024} 次`);
            fetchFiles();
          }
          if (p.status === "error") {
            toast.error(`向量化出错：${p.error}`);
          }
        }
      } catch { /* 忽略 */ }
    }, 2000);
  }, [fetchFiles]);

  // ─── 打标进度轮询 ───

  const startRetagPolling = useCallback(() => {
    if (retagPollingRef.current) return;
    retagPollingRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/admin/knowledge-base/retag-progress");
        const p: RetagProgress = await res.json();
        setRetagProgress(p);
        if (p.status !== "running") {
          if (retagPollingRef.current) {
            clearInterval(retagPollingRef.current);
            retagPollingRef.current = null;
          }
          if (p.status === "completed") {
            toast.success(`打标完成：${p.updatedChunks} 段已更新，${p.skippedChunks} 段跳过，${p.aiCalls} 次 AI 调用`);
            fetchFiles();
            // 如果当前有打开的分段详情，刷新数据
            if (chunksFile) handleViewChunks(chunksFile);
            setSelectedChunkIds(new Set());
          }
          if (p.status === "error") {
            toast.error(`打标出错：${p.error}`);
          }
        }
      } catch { /* 忽略 */ }
    }, 2000);
  }, [fetchFiles, chunksFile]);

  // 初始加载时检查两种进度
  useEffect(() => {
    (async () => {
      try {
        const [idxRes, retagRes] = await Promise.all([
          fetch("/api/admin/knowledge-base/index-progress"),
          fetch("/api/admin/knowledge-base/retag-progress"),
        ]);
        const idxP: IndexProgress = await idxRes.json();
        const retagP: RetagProgress = await retagRes.json();
        setProgress(idxP);
        setRetagProgress(retagP);
        if (idxP.status === "running") startIndexPolling();
        if (retagP.status === "running") startRetagPolling();
      } catch { /* 忽略 */ }
    })();
  }, [startIndexPolling, startRetagPolling]);

  // 清理轮询
  useEffect(() => {
    return () => {
      if (indexPollingRef.current) clearInterval(indexPollingRef.current);
      if (retagPollingRef.current) clearInterval(retagPollingRef.current);
    };
  }, []);

  // ─── 上传 ───

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/admin/knowledge-base/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`${file.name}: ${data.error}`);
        } else {
          toast.success(`${file.name} 上传成功`);
        }
      } catch {
        toast.error(`${file.name} 上传失败`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchFiles();
  };

  // ─── 删除 ───

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除「${name}」？删除后需重建索引以清除向量数据。`)) return;
    try {
      const res = await fetch("/api/admin/knowledge-base/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(data.message);
      fetchFiles();
    } catch {
      toast.error("删除失败");
    }
  };

  // ─── 向量化 ───

  const handleReindex = async () => {
    if (!confirm("确认开始向量化？处理期间会调用 Embedding API，请勿重复触发。")) return;
    setProgress({ status: "running", totalFiles: 0, processedFiles: 0, totalChunks: 0, processedChunks: 0, apiCalls1536: 0, apiCalls1024: 0, skippedChunks: 0, currentFile: "准备中..." });
    startIndexPolling();
    try {
      const res = await fetch("/api/admin/logicdoc-reindex", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error);
        setProgress((p) => ({ ...p, status: "error", error: data.error }));
      }
    } catch {
      toast.error("向量化请求失败");
      setProgress((p) => ({ ...p, status: "error", error: "请求失败" }));
    }
  };

  // ─── 重新打标（后台异步） ───

  /** 启动打标任务并开始轮询 */
  const startRetag = async (
    mode: "system" | "hybrid" | "auto",
    options?: { chunkIds?: string[]; retagFailed?: boolean }
  ) => {
    try {
      const res = await fetch("/api/admin/knowledge-base/retag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          ...(options?.chunkIds?.length ? { chunkIds: options.chunkIds } : {}),
          ...(options?.retagFailed ? { retagFailed: true } : {}),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "启动打标任务失败");
        return;
      }

      // 立即更新 UI 为 running 状态
      setRetagProgress((prev) => ({
        ...prev,
        status: "running",
        mode,
        type: options?.chunkIds?.length ? "chunkIds" : options?.retagFailed ? "retagFailed" : "full",
        currentFile: "准备中...",
      }));
      startRetagPolling();
      toast.success("打标任务已启动，您可以在系统中做其它操作");
    } catch {
      toast.error("启动打标任务失败");
    }
  };

  // ─── 查看分段详情 ───

  const handleViewChunks = async (fileName: string) => {
    setChunksFile(fileName);
    setChunksLoading(true);
    setChunks([]);
    setExpandedChunk(null);
    setChunksPage(1);
    try {
      const res = await fetch(`/api/admin/knowledge-base/chunks?file=${encodeURIComponent(fileName)}&family=${chunksFamily}`);
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); setChunksLoading(false); return; }
      setChunks(data.chunks ?? []);
    } catch {
      toast.error("加载分段数据失败");
    } finally {
      setChunksLoading(false);
    }
  };

  // 切换维度族时重新加载
  useEffect(() => {
    if (chunksFile) handleViewChunks(chunksFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunksFamily]);

  // ─── 标签编辑 ───

  const handleEditTags = async (fileName: string) => {
    setEditingFile(fileName);
    try {
      const res = await fetch(`/api/admin/knowledge-base/tags?file=${encodeURIComponent(fileName)}`);
      const data = await res.json();
      setEditingTags(data.tags ?? []);
      setAvailableTags(data.availableTags ?? []);
    } catch {
      setEditingTags([]);
    }
  };

  const handleSaveTags = async () => {
    if (!editingFile) return;
    try {
      const res = await fetch("/api/admin/knowledge-base/tags", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: editingFile, tags: editingTags }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(data.message ?? "标签已保存");
      setEditingFile(null);
    } catch {
      toast.error("保存失败");
    }
  };

  // ─── 渲染 ───

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">知识库管理</h2>
          <p className="text-sm text-muted-foreground">管理 logicdoc/ 下的知识文档，上传后执行向量化</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading || progress.status === "running"}>
            {uploading ? "上传中..." : "上传文件"}
          </Button>
          <Button onClick={handleReindex} disabled={progress.status === "running" || retagging}>
            {progress.status === "running" ? "向量化中..." : "开始向量化"}
          </Button>
          <Button variant="outline" onClick={() => setShowRetagDialog(true)} disabled={retagging || progress.status === "running"}>
            重新打标
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (confirm("确认重打所有失败的标签？将扫描 biz_modules 为「通用」或空的片段并重新 AI 打标。")) {
                startRetag("system", { retagFailed: true });
              }
            }}
            disabled={retagging || progress.status === "running"}
          >
            重打失败标签
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".md,.docx,.pdf,.xlsx,.xls"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* 向量化进度条 */}
      {progress.status === "running" && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardContent className="py-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">正在向量化：{progress.currentFile}</span>
              <span>{progress.processedChunks} / {progress.totalChunks} 块 ({progress.processedFiles} / {progress.totalFiles} 文件)</span>
            </div>
            <div className="mb-2 h-2 w-full rounded-full bg-blue-200">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all"
                style={{ width: `${progress.totalChunks ? (progress.processedChunks / progress.totalChunks) * 100 : 0}%` }}
              />
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>1536 维 API：{progress.apiCalls1536} 次</span>
              <span>1024 维 API：{progress.apiCalls1024} 次</span>
              <span>跳过（未变）：{progress.skippedChunks} 块</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 向量化完成摘要 */}
      {progress.status === "completed" && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-3 text-sm">
            <span className="font-medium text-green-800">向量化完成</span>
            <span className="ml-2 text-green-700">
              {progress.totalFiles} 文件 / {progress.totalChunks} 块 / 1536 调用 {progress.apiCalls1536} 次 / 1024 调用 {progress.apiCalls1024} 次
            </span>
          </CardContent>
        </Card>
      )}

      {/* 向量化错误提示 */}
      {progress.status === "error" && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-3 text-sm text-red-800">
            <span className="font-medium">向量化出错：</span>{progress.error}
          </CardContent>
        </Card>
      )}

      {/* 打标进度 */}
      {retagProgress.status === "running" && (
        <Card className="border-orange-200 bg-orange-50/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                AI 打标中…
                {retagProgress.currentFile && (
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    当前文件：{retagProgress.currentFile}
                  </span>
                )}
              </CardTitle>
              <span className="text-sm text-muted-foreground">
                {retagProgress.processedChunks} / {retagProgress.totalChunks} 段
                {retagProgress.aiCalls > 0 && ` · ${retagProgress.aiCalls} 次 AI 调用`}
              </span>
            </div>
          </CardHeader>
          <CardContent>
            {/* 进度条 */}
            <div className="mb-3 h-2 w-full rounded-full bg-orange-200">
              <div
                className="h-2 rounded-full bg-orange-500 transition-all"
                style={{
                  width: `${retagProgress.totalChunks ? (retagProgress.processedChunks / retagProgress.totalChunks) * 100 : 0}%`,
                }}
              />
            </div>
            {/* 统计信息 */}
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>模型：{retagProgress.model}</span>
              <span>模式：{retagProgress.mode}</span>
              <span>已更新：{retagProgress.updatedChunks} 段</span>
              <span>跳过：{retagProgress.skippedChunks} 段</span>
              <span>涉及 {retagProgress.files} 个文件</span>
            </div>
            {/* 打标日志 */}
            {retagProgress.logs.length > 0 && (
              <div className="mt-3 max-h-64 overflow-y-auto rounded border bg-white p-2 text-xs font-mono">
                {retagProgress.logs.map((log, i) => (
                  <div
                    key={i}
                    className={`py-0.5 ${
                      log.type === "error"
                        ? "text-red-600"
                        : log.type === "done"
                        ? "text-green-700 font-bold"
                        : log.type === "start"
                        ? "text-blue-700 font-medium"
                        : log.type === "chunk" && log.text.startsWith("✦")
                        ? "text-orange-700"
                        : log.type === "chunk" && log.text.startsWith("⊘")
                        ? "text-muted-foreground italic"
                        : "text-muted-foreground"
                    }`}
                  >
                    <span>{log.text}</span>
                    {log.oldTags && log.newTags && JSON.stringify(log.oldTags) !== JSON.stringify(log.newTags) && (
                      <span className="ml-2 text-muted-foreground">
                        [{log.oldTags.join(",")}] → [{log.newTags.join(",")}]
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              任务在后台运行中，您可以继续其它操作。刷新页面或稍后回来查看进度。
            </p>
          </CardContent>
        </Card>
      )}

      {/* 打标完成 */}
      {retagProgress.status === "completed" && retagProgress.totalChunks > 0 && (
        <Card className="border-green-200 bg-green-50/50">
          <CardContent className="py-3 text-sm">
            <span className="font-medium text-green-800">打标完成</span>
            <span className="ml-2 text-green-700">
              共 {retagProgress.totalChunks} 段 · 更新 {retagProgress.updatedChunks} 段 · 跳过 {retagProgress.skippedChunks} 段 · {retagProgress.aiCalls} 次 AI 调用
            </span>
            {retagProgress.completedAt && (
              <span className="ml-2 text-muted-foreground">
                完成于 {new Date(retagProgress.completedAt).toLocaleString("zh-CN")}
              </span>
            )}
          </CardContent>
        </Card>
      )}

      {/* 打标错误 */}
      {retagProgress.status === "error" && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="py-3 text-sm text-red-800">
            <span className="font-medium">打标出错：</span>{retagProgress.error}
          </CardContent>
        </Card>
      )}

      {/* 重新打标模式选择对话框 */}
      {showRetagDialog && (
        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">选择打标模式</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setShowRetagDialog(false)}>取消</Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              确认对全部已向量化的文件重新执行 AI 打标？不会重算向量，只更新标签。任务在后台运行，不影响其它操作。
            </p>
            <div className="flex flex-col gap-3">
              <Button onClick={() => { setShowRetagDialog(false); startRetag("system"); }}>
                按标签体系打标（严格模式）
              </Button>
              <p className="text-xs text-muted-foreground -mt-1 ml-1">只用 systag 预设标签，不超出范围</p>
              <Button variant="outline" onClick={() => { setShowRetagDialog(false); startRetag("hybrid"); }}>
                标签体系 + AI 补充（推荐）
              </Button>
              <p className="text-xs text-muted-foreground -mt-1 ml-1">优先用预设标签，不够时 AI 自创标签补充</p>
              <Button variant="outline" onClick={() => { setShowRetagDialog(false); startRetag("auto"); }}>
                AI 自动识别（完全自由）
              </Button>
              <p className="text-xs text-muted-foreground -mt-1 ml-1">不依赖标签体系，AI 自由归纳内容特征</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 文件列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">知识库文件</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无文件。请点击「上传文件」添加知识文档。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">文件名</th>
                    <th className="pb-2 pr-4">格式</th>
                    <th className="pb-2 pr-4">标签</th>
                    <th className="pb-2 pr-4">大小</th>
                    <th className="pb-2 pr-4">修改时间</th>
                    <th className="pb-2 pr-4">状态</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">{f.name}</td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${extBadgeColor(f.ext)}`}>
                          {f.ext.replace(".", "").toUpperCase()}
                        </span>
                      </td>
                      <td className="py-2 pr-4">
                        <Button size="sm" variant="ghost" className="h-auto p-1 text-xs" onClick={() => handleEditTags(f.name)}>
                          编辑标签
                        </Button>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatSize(f.size)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(f.modifiedAt).toLocaleString("zh-CN")}</td>
                      <td className="py-2 pr-4">
                        {f.indexed ? (
                          <Badge variant="outline" className="border-green-300 text-green-700">已向量化</Badge>
                        ) : (
                          <Badge variant="outline" className="border-gray-300 text-gray-500">未向量化</Badge>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex gap-1">
                          {f.indexed && (
                            <Button size="sm" variant="outline" onClick={() => handleViewChunks(f.name)}>
                              查看分段
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(f.name)}>
                            删除
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 分段详情弹窗 */}
      {chunksFile && (
        <Card className="border-purple-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle className="text-base">分段详情：{chunksFile}</CardTitle>
              <div className="flex gap-1">
                {(["1536", "1024"] as const).map((dim) => (
                  <Button
                    key={dim}
                    size="sm"
                    variant={chunksFamily === dim ? "default" : "outline"}
                    onClick={() => setChunksFamily(dim)}
                  >
                    {dim} 维
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedChunkIds.size > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={retagging}
                  onClick={() => {
                    const ids = Array.from(selectedChunkIds);
                    if (confirm(`确认对选中的 ${ids.length} 个片段重打标签？任务将在后台运行。`)) {
                      startRetag("system", { chunkIds: ids });
                    }
                  }}
                >
                  重打选中标签 ({selectedChunkIds.size})
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { setChunksFile(null); setSelectedChunkIds(new Set()); }}>关闭</Button>
            </div>
          </CardHeader>
          <CardContent>
            {chunksLoading ? (
              <p className="text-sm text-muted-foreground">加载中...</p>
            ) : chunks.length === 0 ? (
              <p className="text-sm text-muted-foreground">该文件无分段数据（未向量化或维度不匹配）</p>
            ) : (
              <div className="space-y-3">
                {(() => {
                  const totalPages = Math.ceil(chunks.length / chunksPageSize);
                  const start = (chunksPage - 1) * chunksPageSize;
                  const pageChunks = chunks.slice(start, start + chunksPageSize);
                  return (
                    <>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <p className="text-sm text-muted-foreground">共 {chunks.length} 个分段，第 {chunksPage}/{totalPages} 页</p>
                          <label className="flex items-center gap-1 text-xs text-muted-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={pageChunks.length > 0 && pageChunks.every((c) => selectedChunkIds.has(c.id))}
                              ref={(el) => {
                                if (el) {
                                  const allSelected = pageChunks.length > 0 && pageChunks.every((c) => selectedChunkIds.has(c.id));
                                  const someSelected = pageChunks.some((c) => selectedChunkIds.has(c.id));
                                  el.indeterminate = someSelected && !allSelected;
                                }
                              }}
                              onChange={() => {
                                const pageIds = pageChunks.map((c) => c.id);
                                const allSelected = pageIds.every((id) => selectedChunkIds.has(id));
                                setSelectedChunkIds((prev) => {
                                  const next = new Set(prev);
                                  for (const id of pageIds) {
                                    allSelected ? next.delete(id) : next.add(id);
                                  }
                                  return next;
                                });
                              }}
                            />
                            本页全选
                          </label>
                        </div>
                        {totalPages > 1 && (
                          <PaginationControls page={chunksPage} totalPages={totalPages} onPageChange={(p) => { setChunksPage(p); setExpandedChunk(null); }} />
                        )}
                      </div>
                      {pageChunks.map((chunk, idx) => {
                        const globalIdx = start + idx;
                        const isFailed = chunk.biz_modules.length === 0 || (chunk.biz_modules.length === 1 && chunk.biz_modules[0] === "通用");
                        return (
                          <div key={chunk.id} className={`rounded-lg border bg-card p-3 ${isFailed ? "border-orange-300 bg-orange-50/30" : ""}`}>
                            <div
                              className="flex cursor-pointer items-center justify-between"
                              onClick={() => setExpandedChunk(expandedChunk === chunk.id ? null : chunk.id)}
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedChunkIds.has(chunk.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={() => {
                                    setSelectedChunkIds((prev) => {
                                      const next = new Set(prev);
                                      next.has(chunk.id) ? next.delete(chunk.id) : next.add(chunk.id);
                                      return next;
                                    });
                                  }}
                                />
                                <span className="text-xs font-medium text-muted-foreground">#{globalIdx + 1}</span>
                                <span className="text-xs text-muted-foreground">{chunk.id.slice(0, 12)}...</span>
                                <div className="flex gap-1">
                                  {chunk.biz_modules.map((tag) => (
                                    <Badge
                                      key={tag}
                                      variant="secondary"
                                      className={`text-xs ${tag === "通用" ? "border border-orange-300 text-orange-700" : ""}`}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {expandedChunk === chunk.id ? "收起" : "展开"}
                              </span>
                            </div>
                            {expandedChunk === chunk.id && (
                              <div className="mt-3 space-y-2">
                                <pre className="whitespace-pre-wrap rounded bg-muted p-3 text-xs leading-relaxed">{chunk.text}</pre>
                                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                  <span>宫位: {chunk.palaces.join(", ") || "无"}</span>
                                  <span>星曜: {chunk.stars.join(", ") || "无"}</span>
                                  <span>能量级别: {chunk.energy_levels.join(", ") || "无"}</span>
                                  <span>时间范围: {chunk.time_scopes.join(", ") || "无"}</span>
                                  <span>Hash: {chunk.content_hash.slice(0, 12)}...</span>
                                  <span>版本: {chunk.index_version}</span>
                                </div>
                              </div>
                            )}
                            {expandedChunk !== chunk.id && (
                              <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{chunk.text.slice(0, 150)}...</p>
                            )}
                          </div>
                        );
                      })}
                      {totalPages > 1 && (
                        <div className="flex justify-center pt-2">
                          <PaginationControls page={chunksPage} totalPages={totalPages} onPageChange={(p) => { setChunksPage(p); setExpandedChunk(null); }} />
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 标签编辑弹窗 */}
      {editingFile && (
        <Card className="border-orange-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">编辑标签：{editingFile}</CardTitle>
            <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>关闭</Button>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {availableTags.map((tag) => {
                const selected = editingTags.includes(tag);
                return (
                  <Button
                    key={tag}
                    size="sm"
                    variant={selected ? "default" : "outline"}
                    onClick={() => {
                      setEditingTags(
                        selected ? editingTags.filter((t) => t !== tag) : [...editingTags, tag]
                      );
                    }}
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveTags}>保存</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditingFile(null)}>取消</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
