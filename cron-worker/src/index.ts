/**
 * cf100-cron-trigger
 *
 * 轻量 Cloudflare Worker，用于定时触发 cf100-push Pages 的 /api/cron 接口。
 * Cloudflare Pages 不支持 Cron Triggers，所以用独立 Worker 来调度。
 *
 * 部署方式：cd cron-worker && npx wrangler deploy
 */

export interface Env {
  CRON_TARGET_URL: string;
}

const worker = {
  // HTTP 请求处理（用于手动测试）
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/test') {
      return await triggerCron(env);
    }
    return new Response(
      'cf100-cron-trigger is running. Visit /test to manually trigger cron.',
      { status: 200 }
    );
  },

  // Cron 触发器入口
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] Cron triggered, executing...`);
    try {
      const response = await triggerCron(env);
      const body = await response.text();
      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] Cron response: ${
          response.status
        } ${body}`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${new Date().toISOString()}] Cron failed:`, err);
    }
  },
};

export default worker;

async function triggerCron(env: Env): Promise<Response> {
  const targetUrl = env.CRON_TARGET_URL;
  if (!targetUrl) {
    throw new Error('CRON_TARGET_URL is not configured');
  }
  return fetch(targetUrl, {
    method: 'GET',
    headers: {
      'User-Agent': 'cf100-cron-trigger/1.0',
    },
  });
}
