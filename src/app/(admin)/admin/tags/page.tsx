"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ─── 类型 ───

interface TagFile {
  name: string;
  size: number;
  modifiedAt: string;
  tagCount: number;
}

interface TagDefinition {
  name: string;
  desc: string;
  keywords: string[];
}

// ─── 工具函数 ───

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── 主组件 ───

export default function TagsPage() {
  const [files, setFiles] = useState<TagFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [definitions, setDefinitions] = useState<TagDefinition[]>([]);
  const [loadingDefs, setLoadingDefs] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── 文件列表 ───

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/tags/list");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      toast.error("加载标签文件列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── 标签定义 ───

  const fetchDefinitions = useCallback(async () => {
    setLoadingDefs(true);
    try {
      const res = await fetch("/api/admin/tags/definitions");
      if (!res.ok) throw new Error("加载失败");
      const data = await res.json();
      setDefinitions(data.definitions ?? []);
    } catch {
      toast.error("加载标签定义失败");
    } finally {
      setLoadingDefs(false);
    }
  }, []);

  useEffect(() => {
    fetchFiles();
    fetchDefinitions();
  }, [fetchFiles, fetchDefinitions]);

  // ─── 上传 ───

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList?.length) return;
    setUploading(true);

    for (const file of Array.from(fileList)) {
      const form = new FormData();
      form.append("file", file);
      try {
        const res = await fetch("/api/admin/tags/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) {
          toast.error(`${file.name}: ${data.error}`);
        } else {
          toast.success(`${file.name} 上传成功（${data.file.tagCount} 个标签）`);
        }
      } catch {
        toast.error(`${file.name} 上传失败`);
      }
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    fetchFiles();
    fetchDefinitions();
  };

  // ─── 删除 ───

  const handleDelete = async (name: string) => {
    if (!confirm(`确认删除「${name}」？删除后使用该标签体系的打标将不再包含这些标签。`)) return;
    try {
      const res = await fetch("/api/admin/tags/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error); return; }
      toast.success(data.message);
      fetchFiles();
      fetchDefinitions();
    } catch {
      toast.error("删除失败");
    }
  };

  // ─── 渲染 ───

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">标签管理</h2>
          <p className="text-sm text-muted-foreground">
            管理知识库打标签用的标签体系文件，上传后供 AI 打标使用
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? "上传中..." : "上传标签文件"}
          </Button>
          <Button variant="outline" onClick={() => { fetchFiles(); fetchDefinitions(); }}>
            刷新
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleUpload}
          />
        </div>
      </div>

      {/* 标签体系预览 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">
              当前生效标签体系
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                （共 {definitions.length} 个标签）
              </span>
            </CardTitle>
            {loadingDefs && (
              <span className="text-xs text-muted-foreground">加载中...</span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {definitions.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                暂无标签定义。请上传标签文件（JSON 格式，包含 tags 数组）。
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                上传标签文件后，AI 打标将按此标签体系为知识库内容分配标签。
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {definitions.map((tag) => (
                <div key={tag.name} className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-sm">{tag.name}</Badge>
                  </div>
                  {tag.desc && (
                    <p className="text-xs text-muted-foreground mb-1">{tag.desc}</p>
                  )}
                  {tag.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {tag.keywords.slice(0, 6).map((kw) => (
                        <span key={kw} className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                          {kw}
                        </span>
                      ))}
                      {tag.keywords.length > 6 && (
                        <span className="text-xs text-muted-foreground">+{tag.keywords.length - 6}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 标签文件列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">标签文件</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">加载中...</p>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无标签文件。请上传 .json 格式的标签体系文件。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">文件名</th>
                    <th className="pb-2 pr-4">标签数</th>
                    <th className="pb-2 pr-4">大小</th>
                    <th className="pb-2 pr-4">修改时间</th>
                    <th className="pb-2">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.name} className="border-b last:border-0">
                      <td className="py-2 pr-4 font-medium">
                        <span className="inline-block rounded bg-blue-100 px-1.5 py-0.5 text-xs font-medium text-blue-800 mr-2">
                          JSON
                        </span>
                        {f.name}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant="outline" className="text-xs">{f.tagCount} 个标签</Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">{formatSize(f.size)}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{new Date(f.modifiedAt).toLocaleString("zh-CN")}</td>
                      <td className="py-2">
                        <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => handleDelete(f.name)}>
                          删除
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">使用说明</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>1. 上传 JSON 格式的标签体系文件到 systag 目录，文件需包含 <code className="rounded bg-muted px-1">tags</code> 数组</p>
          <p>2. 每个标签需包含 <code className="rounded bg-muted px-1">name</code>（名称）、<code className="rounded bg-muted px-1">desc</code>（描述）、<code className="rounded bg-muted px-1">keywords</code>（关键词）</p>
          <p>3. 支持上传多个标签文件，系统会自动合并（同名标签后者覆盖前者）</p>
          <p>4. 在「知识库」页面的「重新打标」中可选择「按标签体系」或「AI 自动识别」两种打标模式</p>
        </CardContent>
      </Card>
    </div>
  );
}
