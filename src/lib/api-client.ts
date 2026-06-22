/**
 * 统一 API Client —— TanStack Query 之下的 fetch 封装
 *
 * 职责：
 *  - 拼接 baseURL（同源，预留扩展）
 *  - 自动带 credentials（依赖 NextAuth cookie session）
 *  - JSON 请求/响应解析
 *  - 统一错误类型 ApiError（包含 status / payload / message）
 *
 * 不做的事：
 *  - 不做缓存（交给 TanStack Query）
 *  - 不做重试（交给 TanStack Query retry）
 *  - 不做 SSE 流式解析（见 src/hooks/use-ziwei-stream.ts）
 */

export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

interface FetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** 是否解析 JSON 响应，默认 true。SSE/文本场景传 false。 */
  parseJson?: boolean;
}

const DEFAULT_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
};

async function request<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { body, parseJson = true, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = { ...DEFAULT_HEADERS };
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      finalHeaders[key] = value;
    });
  } else if (headers && typeof headers === "object") {
    Object.assign(
      finalHeaders,
      headers as Record<string, string>,
    );
  }

  const res = await fetch(path, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (!res.ok) {
    let payload: unknown = null;
    try {
      payload = parseJson ? await res.json() : await res.text();
    } catch {
      // 响应体无法解析时忽略
    }
    let message = `API ${res.status} ${res.statusText}`;
    if (
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message: unknown }).message === "string"
    ) {
      message = (payload as { message: string }).message;
    }
    throw new ApiError(message, res.status, payload);
  }

  if (!parseJson) {
    return res as unknown as T;
  }

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as unknown as T;
  }

  return (await res.json()) as T;
}

export const apiClient = {
  get: <T = unknown>(path: string, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "GET" }),

  post: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "POST", body }),

  put: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),

  patch: <T = unknown>(path: string, body?: unknown, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),

  delete: <T = unknown>(path: string, options?: FetchOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),

  /** SSE/ReadableStream 专用：返回原始 Response，由调用方解析 */
  stream: (path: string, body?: unknown, options?: FetchOptions) =>
    request<Response>(path, {
      ...options,
      method: "POST",
      body,
      parseJson: false,
      headers: {
        Accept: "text/event-stream",
      },
    }),
};
