### Cloudflare Pages + D1 部署

适合免费部署，利用 Cloudflare Pages + D1 数据库。

**前提**：Fork 本仓库到你的 GitHub。

**步骤 1：创建 Cloudflare Pages 项目**

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/) → Workers & Pages → Create
2. 连接 GitHub 仓库
3. 设置：
   - **Build command**: `pnpm install --frozen-lockfile && pnpm run pages:build`
   - **Build output directory**: `.vercel/output/static`
4. 添加 Compatibility flags: `nodejs_compat`

**步骤 2：创建 D1 数据库**

在 Cloudflare Dashboard → D1 → Create database，执行 `D1初始化.md` 中的 SQL 建表。

**步骤 3：绑定 D1 数据库**

Pages 项目 → Settings → Functions → D1 database bindings → 添加：
- Variable name: `DB`
- D1 database: 选择刚创建的数据库

**步骤 4：设置环境变量**

| 变量名 | 值 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_STORAGE_TYPE` | `d1` | 存储类型 |
| `USERNAME` | `admin` | 管理员用户名 |
| `PASSWORD` | `你的密码` | 管理员密码 |

**步骤 5：部署**

保存后自动部署，访问 `https://xxx.pages.dev`。

**步骤 6（可选）：Cron 定时刷新**

Pages 不支持 Cron Triggers，需要创建独立 Worker：

```javascript
export default {
  async fetch(request, env) {
    if (new URL(request.url).pathname === '/test') {
      await fetch(env.CRON_TARGET_URL);
      return new Response('OK');
    }
    return new Response('Cron Worker running');
  },
  async scheduled(event, env) {
    await fetch(env.CRON_TARGET_URL);
  },
};
```

Worker 设置：
- `CRON_TARGET_URL` = `https://你的域名/api/cron`
- Triggers → Cron: `0 */4 * * *`


## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=MoonTechLab/LunaTV&type=Date)](https://www.star-history.com/#MoonTechLab/LunaTV&Date)
