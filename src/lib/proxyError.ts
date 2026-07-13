/* eslint-disable @typescript-eslint/no-explicit-any */

import { NextResponse } from 'next/server';

// 上游状态码细分：4xx（403 防盗链 / 404 失效等）原样透传，5xx 统一 502
export function upstreamErrorStatus(status: number): number {
  if (status >= 400 && status < 500) return status;
  return 502;
}

// 网络/超时错误细分：超时（AbortError）→ 408，其他不可恢复错误 → 503
export function proxyErrorResponse(error: any, operation: string): Response {
  const isAbort =
    error?.name === 'AbortError' || error?.name === 'TimeoutError';
  return NextResponse.json(
    {
      error: isAbort
        ? `Upstream timeout (${operation})`
        : `Failed to fetch ${operation}`,
    },
    { status: isAbort ? 408 : 503 }
  );
}
