import { NextResponse } from 'next/server';

export const runtime = 'edge';

export async function POST() {
  const response = NextResponse.json({ ok: true });

  // 清除认证cookie
  response.cookies.set('auth', '', {
    path: '/',
    expires: new Date(0),
    sameSite: 'lax', // 改为 lax 以支�?PWA
    httpOnly: false, // PWA 需要客户端可访�?    secure: false, // 根据协议自动设置
  });

  return response;
}
