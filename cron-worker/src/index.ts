/**
 * cf100-cron-trigger
 *
 * 轻量 Cloudflare Worker，用于定时触发 cf100-push Pages 的 /api/cron 接口。
 * Cloudflare Pages 不支持 Cron Triggers，所以用独立 Worker 来调度。
 *
 * v2: 先获取用户列表，再按用户逐个调用 /api/cron?user=xxx，
 *     让每个用户都获得完整的 40 subrequest 预算。
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
      'cf100-cron-trigger v2 is running. Visit /test to manually trigger cron.',
      { status: 200 }
    );
  },

  // Cron 触发器入口
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] Cron triggered, executing...`);
    try {
      const results = await triggerCron(env);
      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] Cron completed: ${results.length} user(s) processed`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${new Date().toISOString()}] Cron failed:`, err);
    }
  },
};

export default worker;

interface CronResult {
  user: string;
  status: number;
  success: boolean;
  subrequests?: number;
  updated?: number;
  cacheHits?: number;
}

async function triggerCron(env: Env): Promise<CronResult[]> {
  const targetUrl = env.CRON_TARGET_URL;
  if (!targetUrl) {
    throw new Error('CRON_TARGET_URL is not configured');
  }

  const results: CronResult[] = [];
  const headers = { 'User-Agent': 'cf100-cron-trigger/2.0' };

  // Step 1: 获取用户列表
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Fetching user list...`);
  const usersResponse = await fetch(`${targetUrl}?action=users`, { headers });

  if (!usersResponse.ok) {
    const errText = await usersResponse.text();
    throw new Error(`Failed to fetch users: ${usersResponse.status} ${errText}`);
  }

  const usersData = (await usersResponse.json()) as {
    success: boolean;
    users?: string[];
    error?: string;
  };

  if (!usersData.success || !usersData.users?.length) {
    // eslint-disable-next-line no-console
    console.log(
      `[${new Date().toISOString()}] No users found or request failed: ${JSON.stringify(usersData)}`
    );
    return results;
  }

  const users = usersData.users;
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Found ${users.length} users: ${users.join(', ')}`);

  // Step 2: 先执行一次无用户参数的调用（刷新配置 + 直播源）
  // eslint-disable-next-line no-console
  console.log(`[${new Date().toISOString()}] Running config + live refresh...`);
  const baseResponse = await fetch(targetUrl, { headers });
  const baseText = await baseResponse.text();
  // eslint-disable-next-line no-console
  console.log(
    `[${new Date().toISOString()}] Config refresh: ${baseResponse.status} ${baseText.substring(0, 200)}`
  );

  // Step 3: 按用户逐个调用，每个用户获得完整 40 subrequest 预算
  for (const user of users) {
    // eslint-disable-next-line no-console
    console.log(`[${new Date().toISOString()}] Processing user: ${user}`);
    try {
      const response = await fetch(`${targetUrl}?user=${encodeURIComponent(user)}`, {
        headers,
      });
      const body = await response.text();

      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(body);
      } catch {
        // non-JSON response
      }

      results.push({
        user,
        status: response.status,
        success: response.ok,
        subrequests: parsed.subrequests as number | undefined,
        updated: parsed.updated as number | undefined,
        cacheHits: parsed.cacheHits as number | undefined,
      });

      // eslint-disable-next-line no-console
      console.log(
        `[${new Date().toISOString()}] User ${user}: ${response.status} | ` +
          `subrequests=${parsed.subrequests ?? '?'} updated=${parsed.updated ?? '?'} ` +
          `cache=${parsed.cacheHits ?? '?'}`
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[${new Date().toISOString()}] User ${user} failed:`, err);
      results.push({ user, status: 0, success: false });
    }

    // 用户之间短暂延迟，避免过快请求
    await new Promise((r) => setTimeout(r, 500));
  }

  // eslint-disable-next-line no-console
  console.log(
    `[${new Date().toISOString()}] All done. ` +
      `Total users: ${results.length}, ` +
      `Successful: ${results.filter((r) => r.success).length}`
  );

  return results;
}
