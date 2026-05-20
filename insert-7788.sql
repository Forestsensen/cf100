-- ============================================================
-- 手动插入/更新 7788 用户到 MoonTV D1 数据库
-- 密码：88888（pbkdf2 哈希，每次生成都不同，这是本次生成的值）
-- 
-- 执行方式：
--   1. 打开 Cloudflare Dashboard
--   2. 进入 Workers & Pages → D1 SQL Database
--   3. 选择你的数据库（如 moontv-d1）
--   4. 点击 "Console" 标签
--   5. 粘贴执行以下 SQL
-- ============================================================

-- 1. 插入 7788 用户（如果已存在则更新密码）
INSERT INTO users (username, password, created_at)
VALUES (
  '7788',
  'pbkdf2:b75bf25242a6ebbbd1c38a079aa556eb:e24f494323bc9ee27bff0a1cb222edeaf1626728e8f3f52e2d1d0ae21cd18b19',
  unixepoch()
);

-- 如果上面报 UNIQUE constraint failed（用户已存在），改用 UPDATE：
-- UPDATE users SET password = 'pbkdf2:b75bf25242a6ebbbd1c38a079aa556eb:e24f494323bc9ee27bff0a1cb222edeaf1626728e8f3f52e2d1d0ae21cd18b19' WHERE username = '7788';

-- 2. 验证用户是否已写入
SELECT * FROM users;

-- 3. 确保 admin:config 里包含 7788（在 UserConfig.Users 里）
-- 先查看当前配置
SELECT config FROM admin_config WHERE id = 1;

-- 如果 UserConfig.Users 里没有 7788，需要手动更新 admin_config
-- 把 config 里的 UserConfig 部分加上 7788
