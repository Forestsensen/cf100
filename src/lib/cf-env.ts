/**
 * 获取 Cloudflare Pages 环境变量的工具函数
 * 在 @cloudflare/next-on-pages Edge Runtime 中，
 * 非 NEXT_PUBLIC_ 开头的环境变量需要通过 getRequestContext().env 获取
 */

interface CfEnv {
  USERNAME?: string;
  PASSWORD?: string;
  DB?: {
    prepare: (query: string) => {
      bind: (...args: unknown[]) => {
        all: () => Promise<unknown[]>;
        first: () => Promise<unknown>;
      };
      run: (...args: unknown[]) => Promise<unknown>;
    };
  };
  [key: string]: unknown;
}

export async function getEnv(): Promise<CfEnv> {
  // getRequestContext is the correct way to access non-NEXT_PUBLIC_ env vars in Edge Runtime.
  // The dynamic import returns { default } in some TS versions, but at runtime the named
  // export is always available. We use type assertion to handle this cross-version issue.
  const nextOnPages = await import('@cloudflare/next-on-pages');
  const getRequestContext = (
    nextOnPages as unknown as { getRequestContext: () => { env: CfEnv } }
  ).getRequestContext;
  const { env } = getRequestContext();
  return env as CfEnv;
}

/** 获取站长用户名 */
export async function getOwnerUsername(): Promise<string | undefined> {
  const env = await getEnv();
  return env.USERNAME || process.env.USERNAME;
}

/** 获取站长密码 */
export async function getOwnerPassword(): Promise<string | undefined> {
  const env = await getEnv();
  return env.PASSWORD || process.env.PASSWORD;
}
