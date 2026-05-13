部署到 CF Pages 的步骤
用修改后的代码替换你 CF Pages 关联的仓库
构建命令：pnpm install --frozen-lockfile && pnpm run pages:build
输出目录：.vercel/output/static
兼容性标志：在 CF Pages 设置中设为 nodejs_compat
存储选择：必须用 D1 或 Upstash（Redis/Kvrocks 不兼容 Edge Runtime）
D1 初始化：参照项目中的 D1初始化.md 执行建表 SQL
环境变量：
NEXT_PUBLIC_STORAGE_TYPE = d1（或 upstash）
USERNAME = 管理员账号
PASSWORD = 管理员密码
