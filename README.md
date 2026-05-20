# ForestTV 部署指南

基于 Next.js + Cloudflare Pages + D1 的影视聚合站。

## 一、Fork 仓库

1. Fork 本仓库到你的 GitHub 账户

## 二、创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 左侧菜单 → **计算（Workers）** → **Workers 和 Pages** → **创建**
3. 选择 **Pages** → **导入现有的 Git 存储库** → 选择你 Fork 的仓库
4. 构建设置：
   - **预设框架**：无
   - **构建命令**：
     ```
     pnpm install --frozen-lockfile && pnpm run pages:build
     ```
   - **构建输出目录**：`.vercel/output/static`
5. 点击 **保存并部署**（首次会失败，正常，继续下面的步骤）

## 三、配置兼容性标志

1. 进入 Pages 项目 → **设置** → **运行时** → **兼容性标志**
2. 添加 `nodejs_compat`
3. 保存

## 四、创建 D1 数据库

1. 左侧菜单 → **存储和数据库** → **D1 SQL 数据库** → **创建**
2. 名称随意（如 `foresttv`），点击 **创建**
3. 进入刚创建的数据库 → 点击左上角 **Explore Data**
4. 将以下 SQL 粘贴到 Query 窗口，点击 **Run All**：

```sql
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS play_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  cover TEXT NOT NULL,
  year TEXT NOT NULL,
  index_episode INTEGER NOT NULL,
  total_episodes INTEGER NOT NULL,
  play_time INTEGER NOT NULL,
  total_time INTEGER NOT NULL,
  save_time INTEGER NOT NULL,
  search_title TEXT,
  UNIQUE(username, key)
);

CREATE TABLE IF NOT EXISTS favorites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  source_name TEXT NOT NULL,
  cover TEXT NOT NULL,
  year TEXT NOT NULL,
  total_episodes INTEGER NOT NULL,
  save_time INTEGER NOT NULL,
  UNIQUE(username, key)
);

CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  keyword TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(username, keyword)
);

CREATE TABLE IF NOT EXISTS admin_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE TABLE IF NOT EXISTS skip_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  source TEXT NOT NULL,
  id_video TEXT NOT NULL,
  enable INTEGER NOT NULL DEFAULT 0,
  intro_time INTEGER NOT NULL DEFAULT 0,
  outro_time INTEGER NOT NULL DEFAULT 0,
  UNIQUE(username, source, id_video)
);

CREATE INDEX IF NOT EXISTS idx_play_records_username ON play_records(username);
CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username);
CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username);
CREATE INDEX IF NOT EXISTS idx_play_records_username_key ON play_records(username, key);
CREATE INDEX IF NOT EXISTS idx_play_records_username_save_time ON play_records(username, save_time DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_username_key ON favorites(username, key);
CREATE INDEX IF NOT EXISTS idx_favorites_username_save_time ON favorites(username, save_time DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_username_keyword ON search_history(username, keyword);
CREATE INDEX IF NOT EXISTS idx_search_history_username_created_at ON search_history(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_source_id ON skip_configs(username, source, id_video);
CREATE INDEX IF NOT EXISTS idx_search_history_username_id_created_at ON search_history(username, id, created_at DESC);
```

## 五、绑定 D1 数据库

1. 返回 Pages 项目 → **设置** → **绑定** → **添加**
2. 选择 **D1 数据库**
3. **变量名称**：`DB`
4. **D1 数据库**：选择你刚创建的数据库
5. 保存

## 六、设置环境变量

进入 Pages 项目 → **设置** → **环境变量**，添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_STORAGE_TYPE` | `d1` | 必须 |
| `USERNAME` | 你的管理员账号 | 如 `admin` |
| `PASSWORD` | 你的管理员密码 | 如 `your_password` |

保存后点击 **重试部署**（或等待自动触发）。

## 七、部署完成

部署成功后访问你的 Pages 域名（如 `xxx.pages.dev`），用设置的账号密码登录即可。

进入 **管理面板** 可配置视频源、站点名称、用户等。

## 八、（可选）Cron 定时刷新

项目包含 `cron-worker/` 目录，用于定时触发剧集数更新。

如需启用：

1. 左侧菜单 → **计算（Workers）** → **创建** → **创建 Worker**
2. 将 `cron-worker/src/index.ts` 的内容粘贴进去
3. 修改 `CRON_TARGET_URL` 为你的 Pages 域名 + `/api/cron`
4. 进入 Worker → **设置** → **触发器** → 添加 Cron 触发器：`0 */4 * * *`（每4小时）

## 自定义域名（可选）

Pages 项目 → **设置** → **自定义域** → 添加你的域名，按提示配置 DNS 即可。
