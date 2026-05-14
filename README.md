# MoonTV

<div align="center">
  <img src="public/logo.png" alt="MoonTV Logo" width="120">
</div>

> 🎬 **MoonTV** 是一个开箱即用的、跨平台的影视聚合播放器。它基于 **Next.js 14** + **Tailwind CSS** + **TypeScript** 构建，支持多资源搜索、在线播放、收藏同步、播放记录、云端存储，让你可以随时随地畅享海量免费影视内容。

<div align="center">

![Next.js](https://img.shields.io/badge/Next.js-14-000?logo=nextdotjs)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-4.x-3178c6?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-Deploy-luu9ff)

</div>

---

## ✨ 功能特性

- 🔍 **多源聚合搜索**：一次搜索立刻返回全源结果。
- 📄 **丰富详情页**：支持剧集列表、演员、年份、简介等完整信息展示。
- ▶️ **流畅在线播放**：集成 HLS.js & ArtPlayer。
- ❤️ **收藏 + 继续观看**：支持 D1/Upstash 云端存储，多端同步进度。
- 📱 **PWA**：离线缓存、安装到桌面/主屏，移动端原生体验。
- 🌐 **响应式布局**：桌面侧边栏 + 移动底部导航，自适应各种屏幕尺寸。
- 🚫 **智能去广告**：自动跳过视频中的切片广告（实验性）。

### 注意：部署后项目为空壳项目，无内置播放源和直播源，需要自行收集

<details>
  <summary>点击查看项目截图</summary>
  <img src="public/screenshot1.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot2.png" alt="项目截图" style="max-width:600px">
  <img src="public/screenshot3.png" alt="项目截图" style="max-width:600px">
</details>

### 请不要在 B站、小红书、微信公众号、抖音、今日头条或其他中国大陆社交平台发布视频或文章宣传本项目，不授权任何"科技周刊/月刊"类项目或站点收录本项目。

## 🗺 目录

- [技术栈](#技术栈)
- [Cloudflare Pages 部署](#cloudflare-pages-部署)
- [其他部署方式](#其他部署方式)
- [配置文件](#配置文件)
- [订阅](#订阅)
- [自动更新](#自动更新)
- [环境变量](#环境变量)
- [客户端](#客户端)
- [Android TV 使用](#android-tv-使用)
- [Roadmap](#roadmap)
- [安全与隐私提醒](#安全与隐私提醒)
- [License](#license)
- [致谢](#致谢)

## 技术栈

| 分类 | 主要依赖 |
| --- | --- |
| 前端框架 | [Next.js 14](https://nextjs.org/) · App Router |
| UI & 样式 | [Tailwind CSS 3](https://tailwindcss.com/) |
| 语言 | TypeScript 4 |
| 播放器 | [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) · [HLS.js](https://github.com/video-dev/hls.js/) |
| 代码质量 | ESLint · Prettier · Jest |
| 部署 | Cloudflare Pages (Edge Runtime) |

## Cloudflare Pages 部署

本项目支持部署到 **Cloudflare Pages**，利用 Edge Runtime 实现全球低延迟访问。

> ⚠️ **重要**：Cloudflare Pages Edge Runtime 不支持 Node.js 专属模块（`redis`、`zlib` 等），仅支持 **D1** 和 **Upstash** 两种存储后端。

### 方案一：一键部署（推荐）

[![Deploy to Cloudflare Pages](https://deploy.workers.cloudflare.com/button)](https://dash.cloudflare.com/?to=/:account/workers-and-pages/create/deploy-to-pages)

点击上方按钮，按提示授权 GitHub 并选择仓库，Cloudflare 会自动创建 Pages 项目并完成初始配置。

### 方案二：手动部署（完整步骤）

#### 第一步：准备代码仓库

**方式 A：使用自己的仓库（推荐）**

1. 访问 [https://github.com/Forestsensen/cf100](https://github.com/Forestsensen/cf100)
2. 点击右上角 **Fork** 按钮，将项目 Fork 到自己的 GitHub 账号下

**方式 B：直接克隆**

```bash
git clone https://github.com/Forestsensen/cf100.git
cd cf100
```

#### 第二步：创建 Cloudflare Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
2. 进入 **Workers & Pages** → **Create Application** → **Pages**
3. 选择 **Connect to Git**
4. 授权 Cloudflare 访问你的 GitHub 账号，选择 `cf100`（或你的 Fork）仓库
5. 点击 **Begin setup**

#### 第三步：配置构建设置

在构建配置页面填写以下信息：

| 字段 | 值 |
| --- | --- |
| **Project name** | `moontv`（可自定义） |
| **Production branch** | `main` |
| **Build command** | `pnpm install --frozen-lockfile && pnpm run pages:build` |
| **Build output directory** | `.vercel/output/static` |
| **Root directory** | `/`（默认，无需修改） |

> 💡 如果使用 `npm` 而非 `pnpm`，将构建命令中的 `pnpm` 替换为 `npm run`。

在 **Environment variables (advanced)** 部分，先添加最基础的两个变量（其他变量在部署完成后再设置）：

| 变量名 | 值 |
| --- | --- |
| `NODE_VERSION` | `18`（或 `20`） |
| `NEXT_PUBLIC_STORAGE_TYPE` | `d1`（或 `upstash`） |

点击 **Save and Deploy**，等待首次构建（约 1-3 分钟）。

> ⚠️ 首次构建**预期会失败**，因为还没有配置 D1 数据库绑定。继续下面的步骤。

#### 第四步：创建并绑定 D1 数据库

MoonTV 在 Cloudflare Pages 上推荐使用 **D1 数据库**（Cloudflare 原生 SQLite）。

1. 在 Cloudflare Dashboard 中，进入你的 Pages 项目
2. 点击 **Settings** → **Bindings**
3. 点击 **Add Binding**，选择 **D1 database**
4. 选择 **Create a database**，输入数据库名称，例如 `moontv-db`
5. 记录下 **Database ID**（类似 `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`）
6. 点击 **Add Binding** 确认

然后在 **Environment variables** 中添加 D1 相关变量：

| 变量名 | 值 |
| --- | --- |
| `D1_DATABASE_ID` | 上一步记录的 Database ID |

#### 第五步：初始化 D1 数据库

数据库创建后需要执行初始化 SQL 来创建表结构。

1. 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)：
   ```bash
   npm install -g wrangler
   ```

2. 登录 Cloudflare 账号：
   ```bash
   wrangler login
   ```

3. 执行初始化 SQL（在项目根目录执行）：
   ```bash
   wrangler d1 execute moontv-db --remote --file=./d1-init.sql
   ```
   
   > 如果还没有 `d1-init.sql`，请参考下方 [D1 数据库初始化](#d1-数据库初始化) 章节创建。

#### 第六步：配置完整环境变量

在 Cloudflare Pages 项目的 **Settings** → **Environment variables** 中，添加所有必要的环境变量：

> ⚠️ **关键提示**：`NEXT_PUBLIC_STORAGE_TYPE` 必须**在首次构建前**设置，因为它会在构建时被嵌入前端代码。如果构建后才添加，需要重新触发部署才能生效。

**必填变量：**

| 变量名 | 说明 | 示例 |
| --- | --- | --- |
| `USERNAME` | 站长账号用户名 | `admin` |
| `PASSWORD` | 站长账号密码 | `your_secure_password` |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储类型 | `d1` |

**可选变量：**

| 变量名 | 说明 | 默认值 |
| --- | --- | --- |
| `SITE_BASE` | 站点 URL | 空 |
| `NEXT_PUBLIC_SITE_NAME` | 站点名称 | `MoonTV` |
| `ANNOUNCEMENT` | 站点公告 | 默认免责声明 |
| `NEXT_PUBLIC_SEARCH_MAX_PAGE` | 搜索最大页数 | `5` |
| `NEXT_PUBLIC_DOUBAN_PROXY_TYPE` | 豆瓣代理类型 | `direct` |
| `NEXT_PUBLIC_DISABLE_YELLOW_FILTER` | 关闭色情过滤 | `false` |
| `NEXT_PUBLIC_FLUID_SEARCH` | 流式搜索输出 | `true` |

添加完成后，回到 **Deployments** 页面，点击 **Manage Deployment** → **Retry all deployments** 触发重新构建。

#### 第七步：验证部署

构建成功后，点击 Cloudflare 提供的 `*.pages.dev` 域名访问你的站点。

1. **检查登录界面**：如果看到**用户名+密码**两个输入框，说明 D1 模式已生效；如果只有密码输入框，说明 `NEXT_PUBLIC_STORAGE_TYPE` 未生效，请检查环境变量并重新部署。
2. 使用设置的 `USERNAME` 和 `PASSWORD` 登录
3. 进入管理后台，填写配置文件（API 资源站地址）
4. 测试搜索、播放、收藏功能是否正常

---

### 🔐 登录密码错误排查

如果部署后提示"密码错误"，请按以下顺序排查：

| 现象 | 原因 | 解决方案 |
| --- | --- | --- |
| 登录界面只有密码框，没有用户名框 | `NEXT_PUBLIC_STORAGE_TYPE` 未生效，前端以 `localstorage` 模式运行 | 检查环境变量中 `NEXT_PUBLIC_STORAGE_TYPE=d1` 是否设置，**重新触发部署** |
| 有用户名+密码框，但提示密码错误 | 输入的密码与 `PASSWORD` 环境变量不一致 | 检查 Cloudflare Pages 环境变量中的 `PASSWORD` 值 |
| 有用户名+密码框，站长账号登录失败 | `USERNAME` 和 `PASSWORD` 环境变量未设置 | 检查并设置这两个环境变量，重新部署 |

**重要**：`NEXT_PUBLIC_` 前缀的变量在 Next.js 中是在**构建时**嵌入前端的，不是运行时读取的。修改后必须重新构建才能生效。

---

### Upstash 存储部署（替代方案）

如果不使用 D1，可以用 Upstash Redis：

1. 注册 [Upstash](https://upstash.com/) 并创建 Redis 实例
2. 在 Cloudflare Pages 环境变量中添加：
   - `NEXT_PUBLIC_STORAGE_TYPE` = `upstash`
   - `UPSTASH_URL` = Upstash 提供的 REST URL
   - `UPSTASH_TOKEN` = Upstash 提供的 Token

> ⚠️ Upstash 使用 REST API 而非原生 Redis 协议，免费额度有限。

---

### D1 数据库初始化

在 Cloudflare D1 中执行以下 SQL 来创建所需的表：

```sql
-- 用户表（包含密码，created_at 使用 strftime 兼容 D1）
CREATE TABLE IF NOT EXISTS users (
  username TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 播放记录表
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

-- 收藏表
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

-- 搜索历史表
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  keyword TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  UNIQUE(username, keyword)
);

-- 管理员配置表（代码中使用 id=1, config 列）
CREATE TABLE IF NOT EXISTS admin_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  config TEXT NOT NULL,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

-- 跳过配置表（片头片尾）
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

-- 基本索引
CREATE INDEX IF NOT EXISTS idx_play_records_username ON play_records(username);
CREATE INDEX IF NOT EXISTS idx_favorites_username ON favorites(username);
CREATE INDEX IF NOT EXISTS idx_search_history_username ON search_history(username);

-- 复合索引优化查询性能
CREATE INDEX IF NOT EXISTS idx_play_records_username_key ON play_records(username, key);
CREATE INDEX IF NOT EXISTS idx_play_records_username_save_time ON play_records(username, save_time DESC);
CREATE INDEX IF NOT EXISTS idx_favorites_username_key ON favorites(username, key);
CREATE INDEX IF NOT EXISTS idx_favorites_username_save_time ON favorites(username, save_time DESC);
CREATE INDEX IF NOT EXISTS idx_search_history_username_keyword ON search_history(username, keyword);
CREATE INDEX IF NOT EXISTS idx_search_history_username_created_at ON search_history(username, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_skip_configs_username_source_id ON skip_configs(username, source, id_video);
CREATE INDEX IF NOT EXISTS idx_search_history_username_id_created_at ON search_history(username, id, created_at DESC);
```

将以上 SQL 保存为 `d1-init.sql`，然后通过 Wrangler 执行：

```bash
wrangler d1 execute moontv-db --remote --file=./d1-init.sql
```

---

## 其他部署方式

### Docker 部署

```yaml
services:
  moontv-core:
    image: ghcr.io/moontechlab/lunatv:latest
    container_name: moontv-core
    restart: on-failure
    ports:
      - '3000:3000'
    environment:
      - USERNAME=admin
      - PASSWORD=admin_password
      - NEXT_PUBLIC_STORAGE_TYPE=kvrocks
      - KVROCKS_URL=redis://moontv-kvrocks:6666
    networks:
      - moontv-network
    depends_on:
      - moontv-kvrocks
  moontv-kvrocks:
    image: apache/kvrocks
    container_name: moontv-kvrocks
    restart: unless-stopped
    volumes:
      - kvrocks-data:/var/lib/kvrocks
    networks:
      - moontv-network
networks:
  moontv-network:
    driver: bridge
volumes:
  kvrocks-data:
```

> 完整 Docker 部署说明请参考[项目原文档](#)。

---

## 配置文件

完成部署后为空壳应用，无播放源，需要站长在管理后台的配置文件设置中填写配置文件（后续会支持订阅）。

配置文件示例如下：

```json
{
  "cache_time": 7200,
  "api_site": {
    "dyttzy": {
      "api": "http://xxx.com/api.php/provide/vod",
      "name": "示例资源",
      "detail": "http://xxx.com"
    }
    // ...更多站点
  },
  "custom_category": [
    {
      "name": "华语",
      "type": "movie",
      "query": "华语"
    }
  ]
}
```

- `cache_time`：接口缓存时间（秒）。
- `api_site`：你可以增删或替换任何资源站，字段说明：
  - `key`：唯一标识，保持小写字母/数字。
  - `api`：资源站提供的 `vod` JSON API 根地址。
  - `name`：在人机界面中展示的名称。
  - `detail`：（可选）部分无法通过 API 获取剧集详情的站点，需要提供网页详情根 URL，用于爬取。
- `custom_category`：自定义分类配置，用于在导航中添加个性化的影视分类。

MoonTV 支持标准的苹果 CMS V10 API 格式。

## 订阅

将完整的配置文件 base58 编码后提供 http 服务即为订阅链接，可在 MoonTV 后台/Helios 中使用。

## 自动更新

可借助 [watchtower](https://github.com/containrrr/watchtower) 自动更新镜像容器。

dockge/komodo 等 docker compose UI 也有自动更新功能。

## 环境变量

| 变量 | 说明 | 可选值 | 默认值 |
| --- | --- | --- | --- |
| `USERNAME` | 站长账号 | 任意字符串 | 无默认，必填字段 |
| `PASSWORD` | 站长密码 | 任意字符串 | 无默认，必填字段 |
| `SITE_BASE` | 站点 url | 形如 `https://example.com` | 空 |
| `NEXT_PUBLIC_SITE_NAME` | 站点名称 | 任意字符串 | `MoonTV` |
| `ANNOUNCEMENT` | 站点公告 | 任意字符串 | 默认免责声明 |
| `NEXT_PUBLIC_STORAGE_TYPE` | 存储方式 | `d1`、`upstash`（Cloudflare Pages）<br>`redis`、`kvrocks`（Docker） | 无默认，必填 |
| `D1_DATABASE_ID` | D1 数据库 ID | Cloudflare D1 ID | 空（D1 方式必填） |
| `UPSTASH_URL` | Upstash Redis URL | URL | 空 |
| `UPSTASH_TOKEN` | Upstash Token | Token | 空 |
| `KVROCKS_URL` | Kvrocks 连接 url | 连接 url | 空 |
| `REDIS_URL` | Redis 连接 url | 连接 url | 空 |
| `NEXT_PUBLIC_SEARCH_MAX_PAGE` | 搜索接口最大页数 | 1-50 | `5` |
| `NEXT_PUBLIC_DOUBAN_PROXY_TYPE` | 豆瓣数据源请求方式 | `direct`/`cors-proxy-zwei`/`cmliussss-cdn-tencent`/`cmliussss-cdn-ali`/`custom` | `direct` |
| `NEXT_PUBLIC_DOUBAN_PROXY` | 自定义豆瓣数据代理 URL | url prefix | 空 |
| `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY_TYPE` | 豆瓣图片代理类型 | `direct`/`server`/`img3`/`cmliussss-cdn-tencent`/`cmliussss-cdn-ali`/`custom` | `direct` |
| `NEXT_PUBLIC_DOUBAN_IMAGE_PROXY` | 自定义豆瓣图片代理 URL | url prefix | 空 |
| `NEXT_PUBLIC_DISABLE_YELLOW_FILTER` | 关闭色情内容过滤 | `true`/`false` | `false` |
| `NEXT_PUBLIC_FLUID_SEARCH` | 是否开启搜索接口流式输出 | `true`/`false` | `true` |

## 客户端

v100.0.0 以上版本可配合 [Selene](https://github.com/MoonTechLab/Selene) 使用，移动端体验更加友好，数据完全同步。

## Android TV 使用

目前该项目可以配合 [OrionTV](https://github.com/zimplexing/OrionTV) 在 Android TV 上使用，可以直接作为 OrionTV 后端。

已实现播放记录和网页端同步。

## 安全与隐私提醒

### 请设置密码保护并关闭公网注册

为了您的安全和避免潜在的法律风险，我们要求在部署时**强烈建议关闭公网注册**：

### 部署要求

1. **设置环境变量 `PASSWORD`**：为您的实例设置一个强密码
2. **仅供个人使用**：请勿将您的实例链接公开分享或传播
3. **遵守当地法律**：请确保您的使用行为符合当地法律法规

### 重要声明

- 本项目仅供学习和个人使用
- 请勿将部署的实例用于商业用途或公开服务
- 如因公开分享导致的任何法律问题，用户需自行承担责任
- 项目开发者不对用户的使用行为承担任何法律责任
- 本项目不在中国大陆地区提供服务。如有该项目在向中国大陆地区提供服务，属个人行为。在该地区使用所产生的法律风险及责任，属于用户个人行为，与本项目无关，须自行承担全部责任。特此声明

## License

[MIT](LICENSE) © 2025 MoonTV & Contributors

## 致谢

- [ts-nextjs-tailwind-starter](https://github.com/theodorusclarence/ts-nextjs-tailwind-starter) — 项目最初基于该脚手架。
- [LibreTV](https://github.com/LibreSpark/LibreTV) — 由此启发，站在巨人的肩膀上。
- [ArtPlayer](https://github.com/zhw2590582/ArtPlayer) — 提供强大的网页视频播放器。
- [HLS.js](https://github.com/video-dev/hls.js) — 实现 HLS 流媒体在浏览器中的播放支持。
- [Zwei](https://github.com/bestzwei) — 提供获取豆瓣数据的 cors proxy
- [CMLiu](https://github.com/cmliu) — 提供豆瓣 CDN 服务
- 感谢所有提供免费影视接口的站点。

## Star History

[![Star History Chart](https://api.star-history.com/svg?repo=Forestsensen/cf100&type=Date)](https://www.star-history.com/#Forestsensen/cf100&Date)
