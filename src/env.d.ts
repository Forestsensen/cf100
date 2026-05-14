/**
 * Cloudflare Pages Edge Runtime 环境变量类型声明
 * 用于 @cloudflare/next-on-pages 的 getRequestContext()
 */

interface CloudflareEnv {
  USERNAME: string;
  PASSWORD: string;
  /** D1 数据库绑定 */
  DB: D1Database;
  [key: string]: unknown;
}

declare module '@cloudflare/next-on-pages' {
  interface RequestContext {
    env: CloudflareEnv;
    ctx: ExecutionContext;
    cf: IncomingRequestCfProperties;
  }
}
