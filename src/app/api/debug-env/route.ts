import { NextResponse } from 'next/server';

import { getEnv } from '@/lib/cf-env';
import { hashPassword } from '@/lib/password';

export const runtime = 'edge';

export async function GET() {
  try {
    const env = await getEnv();

    // Try to insert user 7788 with password 88888
    let insertResult = null;
    let insertError = null;
    try {
      if (env.DB) {
        const hashed = await hashPassword('88888');
        insertResult = (await env.DB.prepare(
          'INSERT INTO users (username, password) VALUES (?, ?)'
        )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .bind('7788', hashed)) as any;
        await insertResult.run();

        // Verify insertion
        const check = (await env.DB.prepare(
          'SELECT username, password, created_at FROM users WHERE username = ?'
        )
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .bind('7788')) as any;
        insertResult = await check.first();
      }
    } catch (err) {
      insertError = String(err);
    }

    return NextResponse.json({
      insertResult,
      insertError,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
