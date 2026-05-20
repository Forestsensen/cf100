部署步骤
Fork 本仓库到你的 GitHub 账户
登陆 Cloudflare，点击 计算（Workers）→ Workers 和 Pages，点击创建
选择 Pages，导入现有的 Git 存储库，选择 Fork 后的仓库
构建命令填写：
pnpm install --frozen-lockfile && pnpm run pages:build
预设框架为无，构建输出目录为 .vercel/output/static
首次部署完成后进入 设置，将兼容性标志设置为 nodejs_compat
点击 存储和数据库 → D1 SQL 数据库，创建一个新的数据库，名称随意
进入刚创建的数据库，点击左上角的 Explore Data，将上方 SQL 粘贴到 Query 窗口后点击 Run All
返回 Pages 项目，进入 设置 → 绑定，添加绑定 D1 数据库，选择你刚创建的数据库，变量名称填 DB
新增环境变量：
NEXT_PUBLIC_STORAGE_TYPE = d1
USERNAME = 管理员账号
PASSWORD = 管理员密码
重试部署