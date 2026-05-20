-- ============================================================
-- 完整恢复用户 7788 的数据到 MoonTV D1 数据库
-- 数据来源：Upstash Redis（通过 REST API 提取）
-- 密码：88888（PBKDF2-SHA256 哈希，本次生成）
--
-- 执行方式：
--   1. 打开 Cloudflare Dashboard
--   2. 进入 Workers & Pages > D1 SQL Database
--   3. 选择数据库
--   4. 点击 "Console" 标签
--   5. 粘贴执行以下 SQL（D1 Console 不支持事务，逐条执行即可）
--
-- 生成时间：2026-05-14T06:46:51.430Z
-- ============================================================

-- ============================================
-- 1. 插入用户 7788（如果已存在则更新密码）
-- ============================================
INSERT OR IGNORE INTO users (username, password, created_at)
VALUES (
  '7788',
  'pbkdf2:ae0e0a1c64a45d3155ca73d2086f27f6:e99f8d014b2d9491b0e14e516a7850cec1c337c664f0abf60046b886c0c06d46',
  unixepoch()
);
-- 如果用户已存在，更新密码：
UPDATE users SET password = 'pbkdf2:ae0e0a1c64a45d3155ca73d2086f27f6:e99f8d014b2d9491b0e14e516a7850cec1c337c664f0abf60046b886c0c06d46' WHERE username = '7788';

-- ============================================
-- 2. 收藏 (46 条）
-- ============================================
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+16720', '灵武大陆', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250410-1/51841fb8e5806d0150c3882090bb6aeb.jpg', '2024', 151, 1768269068719);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+77515', '全民模拟：开局打造专属金手指', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-12-26/202512261766711559.jpg', '2025', 74, 1768269050604);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'zy360+64627', '混沌天帝诀·动态漫', '360资源', 'https://www.imgzy360.com:7788/upload/vod/20240827-1/a3c5c9dd2b0da313c887c1b4f5d1d1a9.png', '2024', 117, 1766542247800);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+52330', '遇强则强，我的修为无上限', '爱奇艺', 'https://ikunpicvrfmn.com/upload/vod/20250605-1/1b78c25ce55b760594fb59152b1ee6ad.jpg', '2025', 97, 1768269043253);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+58487', '绝世神皇', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250913-1/634e1d23fe19f60446c5e44818b50aea.jpg', '2025', 40, 1768268961070);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+72146', '荒古恩仇录·破风篇', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-09-17/17580751861.jpg', '2025', 40, 1766645879686);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+39929', '寒冰末日：我屯了千亿物资', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250409-1/beb6566410208fab896e56345c44ef50.webp', '2024', 73, 1766648776802);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+48448', '大主宰年番', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250408-1/e3afbd8d7cfdfb9eb96d8f7b75e61f22.jpg', '2023', 59, 1768269074806);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+52966', '全民御兽：开局山海经，我横扫全球', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/248f81113fdd6dcc9f8d8d833236acc4.jpg', '2025', 248, 1768269054863);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+52968', '神戒降临：最强异世界', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/cfe119eebe49e22b26e3198ba1a831e5.jpg', '2025', 72, 1766651958326);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+59760', '神在囧途', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250929-1/e2e234ec48a6667e7e21b8bd030ab75c.jpg', '2025', 40, 1768269033680);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+52972', '我靠捡垃圾上王者', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/f8db234e022490b3a11fcc5578fe488e.jpg', '2025', 70, 1768268975505);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+68035', '现在就出发第三季', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251018-1/30d65d293ca640d6366be24b7524bb9e.jpg', '2025', 57, 1766645888280);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'lovedan.net+159891', '大象无形动态漫画', '艾旦影视', 'https://ddmf.net/upload/vod/20250718-1/ab0331797e5a9fbc69c5e4d0befdd775.jpg', '2025', 63, 1768269061797);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+63488', '天命大神皇', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250911-1/234a37ab335bc9e3771bbfc2c33b7390.jpg', '2025', 40, 1768269046468);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+52967', '神的欲望游戏', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/027635eaa900de5a8548cb657ef6b2a4.jpg', '2025', 112, 1768268956252);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'lovedan.net+122720', '末世神级升级系统动态漫画第一季', '艾旦影视', 'https://ddmf.net//upload/vod/20240502-1/fbf80709ce8d0a264caf0e60429d0d71.jpg', '2024', 100, 1768269064216);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'ukuapi+58701', '全职法神！我即是规则 动态漫画', 'U酷资源', 'https://img.ukuapi88.com/upload/vod/20250723-1/89405f5bc367aa013aa8ad290e80c6bf.jpg', '2025', 40, 1766632779769);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+73243', '玄界之门', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251203-1/b3af93d4f008f7a95926050244424853.jpg', '2025', 13, 1768268947222);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dbzy.tv+84114', '全民转职：无职的我终结了神明', '豆瓣资源', 'https://dbzy5.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg', '2025', 46, 1766645876080);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+56285', '超凡进化动态漫画', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2024-07-19/17213666461.jpg', '2024', 90, 1768268962346);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+8977', '炼气十万年', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250411-1/098397c4e4ff4a2347977acf15155e29.jpg', '2023', 316, 1766645873332);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'jinyingzy.com+77597', '死灵法师！我即是天灾', '金鹰点播', 'https://image.jinyingimage.com/cover/5a288002f09bd19f935d15e17899a9b3.jpg', '2024', 215, 1768269049615);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dbzy+101937', '末世重生：我靠开箱子问鼎巅峰', '豆瓣资源', 'https://dbzy5.com/upload/vod/20250816-1/ac6a4cfbd3c689ecfcf5e92b5c072e4e.jpg', '2025', 54, 1769234377457);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+70510', '神墓年番', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-08-08/17546210291.jpg', '2025', 27, 1766632759968);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+67244', '剑来第二季', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251225-1/5c6ffada277f6e6387a66970fd7a74b9.jpg', '2025', 9, 1768268945766);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+65035', '傲世丹神', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251202-1/910ef915b5ead419ad0c583474d506a2.jpg', '2025', 11, 1766648360217);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+75297', '永生之太元仙府', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251220-1/322973deffe216cf3b01b50a25eba298.jpg', '2025', 10, 1768269040153);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+67583', '光阴之外', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251228-1/1423294eafec0ad41676b37316c09a42.jpg', '2025', 8, 1768269047728);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+72006', '九阳武神', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251122-1/e9ae983bf88da572fdcf6c22c32e39c3.jpg', '2025', 15, 1768269042198);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+77824', '地狱模式～喜欢速通游戏的玩家在废设定异世界无双～', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20260110-1/aaa44ef25862a1d1b3fd056cab169434.jpg', '2026', 5, 1768269063264);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'api.ukuapi88.com+55174', '从哥布林到哥布林神 动态漫画', 'U酷资源', 'https://img.ukuapi88.com/upload/vod/20250415-1/c18cfec514274a00bafb4b18b9c2055c.jpg', '2025', 46, 1767345945069);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+56651', '武碎星河', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250817-1/0604d1dc0720d2576a7ddebfb9a5374b.jpg', '2025', 52, 1766646409732);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+73937', '百炼成神3', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251209-1/48bf5a33af49170a2741b8ca1b0d610e.jpg', '2025', 11, 1768269057869);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+53963', '凌天独尊', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250702-1/d4b488272a48a620a54c802290757e4c.jpg', '2025', 60, 1768269059330);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+55230', '双生武魂', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250723-1/bd207ded120d87e691c9b49cf1a6512f.jpg', '2025', 60, 1768268950875);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'jinyingzy.com+93272', '反套路斩神，我拒绝转职SSS级', '金鹰点播', 'https://image.jinyingimage.com/cover/7dac40ce6a8cf652eeb730916b72352a.jpg', '2025', 91, 1768269055879);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'tyyszy.com+48300', '天命大神皇', '天涯影视', 'http://tyyswimg.com/upload/vod/20250912-1/48f33d16e6e6aa387a762bf2056b098f.jpg', '2025', 40, 1767535591409);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'mtzy.me+84114', '全民转职：无职的我终结了神明', '茅台资源', 'https://mtzy2.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg', '2025', 46, 1768269035224);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+59837', '谷围南亭第一卷国语', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250930-1/e6d6483a59f42d61d9305ebe32ec36dc.jpg', '2025', 16, 1766652203830);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'www.maoyanzy.com+143880', '全职法神！我即是规则', '猫眼资源', 'http://www.maoyanimg.top/upload/vod/20250723-26/7a33a2b7eaa6d6e2e7444bcc2fe4e130.jpg', '2025', 47, 1766645878340);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'dyttzyapi.com+67942', '天相', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251018-1/b606dbd991ad4195044ad4266fd84685.jpg', '2025', 19, 1768269036040);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+78394', '天赋长生，我出卖寿命成神动态漫画', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2026-01-01/202601011767230014.jpg', '2025', 80, 1768269051864);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+59441', '大唐乘风录', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250925-1/3f2cada4e417d2ff0aa51c2f4d22f897.jpg', '2025', 21, 1766649959515);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'iqiyizyapi.com+64560', '玄界之门', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251126-1/62cdf05eb301fa4741a0c74d0adf3791.jpg', '2025', 12, 1766645874649);
INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', 'yzzy+72721', '转职阎王：我执掌了生死簿动态漫画', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-10-01/202510011759311031.jpg', '2025', 36, 1768268948740);

-- ============================================
-- 3. 播放记录 (65 条）
-- ============================================
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+60310', '一拳超人第三季', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251006-1/4179a693b2a0deba0266cc631ef529da.jpg', '2025', 11, 13, 1113, 1441, 1767073908223, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'lovedan.net+122720', '末世神级升级系统动态漫画第一季', '艾旦影视', 'https://ddmf.net//upload/vod/20240502-1/fbf80709ce8d0a264caf0e60429d0d71.jpg', '2024', 100, 100, 303, 346, 1769566555575, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'xinlangapi.com+129368', '死灵法师！我即是天灾', '新浪资源', 'https://xinlangtupian.com/cover/5a288002f09bd19f935d15e17899a9b3.jpg', '2024', 250, 253, 277, 321, 1777853725220, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+52968', '神戒降临：最强异世界', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/cfe119eebe49e22b26e3198ba1a831e5.jpg', '2025', 72, 72, 332, 398, 1768344833766, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'lovedan.net+159891', '大象无形动态漫画', '艾旦影视', 'https://ddmf.net/upload/vod/20250718-1/ab0331797e5a9fbc69c5e4d0befdd775.jpg', '2025', 63, 63, 328, 365, 1769605466781, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+58487', '绝世神皇', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250913-1/634e1d23fe19f60446c5e44818b50aea.jpg', '2025', 40, 40, 553, 596, 1768798137455, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+58861', '荒古恩仇录·破风篇', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250917-1/a4dee95aa4676fb4bd5b72fc16468bad.jpg', '2025', 40, 40, 574, 646, 1768658455293, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+75297', '永生之太元仙府', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251220-1/322973deffe216cf3b01b50a25eba298.jpg', '2025', 12, 16, 8, 1489, 1771794570180, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'jszyapi.com+90416', '反套路斩神，我拒绝转职SSS级', '极速资源', 'https://img.jisuimage.com/cover/7dac40ce6a8cf652eeb730916b72352a.jpg', '2025', 122, 122, 152, 153, 1775876927488, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'yzzy+56285', '超凡进化动态漫画', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2024-07-19/17213666461.jpg', '2024', 90, 90, 223, 413, 1767422919475, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+80845', '哈哈哈哈哈第六季', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20260401-1/57914e6e00d6f2559a09706f5a22ac41.webp', '2026', 29, 32, 5195, 5409, 1778336055562, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+55230', '双生武魂', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250723-1/bd207ded120d87e691c9b49cf1a6512f.jpg', '2025', 60, 60, 410, 650, 1768865973254, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dbzy+101937', '末世重生：我靠开箱子问鼎巅峰', '豆瓣资源', 'https://dbzy5.com/upload/vod/20250816-1/ac6a4cfbd3c689ecfcf5e92b5c072e4e.jpg', '2025', 54, 54, 338, 350, 1766498534926, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'jszyapi.com+70453', '末世重生：我靠开箱子问鼎巅峰', '极速资源', 'https://img.jisuimage.com/cover/e1688cd9baac409414fac365110dd2be.jpg', '2025', 76, 76, 236, 242, 1778375894776, '末世重生');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+59247', '神墓年番', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250808-1/75f8ddc3d5c7ff862b58a7d95387ec3b.jpg', '2025', 41, 41, 1111, 1229, 1778376958191, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+69609', '全能高手', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251101-1/5b40b3da853673eb90e8dd0b252e12f8.jpg', '2025', 20, 20, 543, 744, 1775462027466, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+63488', '天命大神皇', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250911-1/234a37ab335bc9e3771bbfc2c33b7390.jpg', '2025', 40, 40, 587, 626, 1768214155623, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'jszyapi.com+73544', '末日狠人：开局囤积万亿物资 动态漫画', '极速资源', 'https://img.jisuimage.com/cover/e261d6435a36803e1c6e6e6c019eb082.jpg', '2025', 60, 61, 246, 279, 1778297680642, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+65035', '大唐乘风录', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250925-1/50ac71b775e6eb9de011df20c8d5d2a7.jpg', '2025', 26, 26, 1117, 1231, 1776602925750, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'yzzy+72721', '转职阎王：我执掌了生死簿动态漫画', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-10-01/202510011759311031.jpg', '2025', 36, 36, 143, 213, 1768343991557, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+59760', '神在囧途', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250929-1/e2e234ec48a6667e7e21b8bd030ab75c.jpg', '2025', 40, 40, 554, 655, 1770890643255, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+73243', '玄界之门', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251203-1/b3af93d4f008f7a95926050244424853.jpg', '2025', 26, 26, 1126, 1267, 1778167403955, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+76153', '山海经密码', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251227-1/0b11155e4406025817f62e869f48d587.jpg', '2025', 13, 13, 1082, 1212, 1776260120492, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+76223', '光阴之外', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251228-1/78a5ae2130d1ca70a8a89a0358411ab6.jpg', '2025', 20, 21, 1356, 1530, 1778162965798, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+53046', '我，进化，恶魔', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250618-1/3de886c1ccdbf965fb3f7bff6314def9.jpg', '2025', 38, 38, 299, 329, 1769267145706, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+69030', '全职法神！我即是规则', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20260113-1/336a79838b22b414123c1904de74aebc.jpg', '2025', 73, 75, 220, 334, 1777965701749, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', '360zy.com+90809', '大主宰年番', '360 资源', 'https://www.imgzy360.com:7788/upload/vod/20260206-1/461e737c3ed3f92aa513c26286e4726a.webp', '2023', 72, 72, 20, 1245, 1778379313650, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'jszyapi.com+73549', '从哥布林到哥布林神 动态漫画', '极速资源', 'https://img.jisuimage.com/cover/b5419639a68181f34ce2a65908a4008e.jpg', '2025', 61, 61, 7, 281, 1778678220566, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+54927', '龙族第二季', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250718-1/f10e4b336ca8fae91d9589d16f2e762b.jpg', '2025', 6, 24, 1380, 1453, 1767193490210, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+79338', '史上最强炼体老祖', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20260126-1/0b45029f4820e2cc2deaf78f545c2568.webp', '2026', 4, 17, 449, 465, 1769743795808, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'mtzy.me+84114', '全民转职：无职的我终结了神明', '茅台资源', 'https://mtzy2.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg', '2025', 46, 46, 255, 281, 1769812682715, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'tyyszy.com+52386', '超凡进化', '天涯影视', 'http://tyyswimg.com/upload/vod/20251230-1/7bcfb90ccfbd8a6e72b7d931007348aa.jpg', '2025', 14, 14, 756, 902, 1767278843826, '超凡进化');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzy+54308', '废渊战鬼', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250706-1/5ef763e893f71a738ed5eb910422c060.jpg', '2025', 5, 24, 1208, 1420, 1761916298342, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'ikunzy.com+67119', '天赋长生，我出卖寿命成神', 'iKun资源', 'https://tu.ikisfyigdaisasdad.com/upload/vod/20260116-1/a22173cb03a5add241bd5b2cb20df985.jpg', '2025', 114, 114, 139, 139, 1778164318876, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+52972', '我靠捡垃圾上王者', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/f8db234e022490b3a11fcc5578fe488e.jpg', '2025', 70, 70, 266, 274, 1768269030560, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', '360zy.com+64627', '混沌天帝诀·动态漫', '360 资源', 'https://www.imgzy360.com:7788/upload/vod/20240827-1/a3c5c9dd2b0da313c887c1b4f5d1d1a9.png', '2024', 134, 134, 194, 231, 1776234560042, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+65035', '傲世丹神', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251202-1/910ef915b5ead419ad0c583474d506a2.jpg', '2025', 12, 12, 1075, 1156, 1771543063205, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzy+58764', '万剑王座', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250804-1/96f67d4e64e8a9293728f6f8c264b58b.jpg', '2025', 40, 40, 551, 638, 1765547324187, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+43236', '宗门里除了我都是卧底', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250408-1/33fed2afbd9bb7be43abfa20559ed207.jpg', '2024', 149, 151, 425, 429, 1778050801131, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'yzzy+77496', '剑来第二季', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-12-25/202512251766628696.jpg', '2025', 27, 27, 1795, 1927, 1777167435022, '剑来');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'jinyingzy+71328', '百斩屠神 动态漫画', '金鹰点播', 'https://image.jinyingimage.com/cover/9e0e40a51b6ed794dbcfbd46410ba102.jpg', '2025', 73, 73, 98, 319, 1761012128328, '百斩屠神');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+59837', '谷围南亭第一卷国语', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250930-1/e6d6483a59f42d61d9305ebe32ec36dc.jpg', '2025', 16, 16, 1044, 1227, 1767401405038, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+72006', '九阳武神', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251122-1/e9ae983bf88da572fdcf6c22c32e39c3.jpg', '2025', 27, 28, 589, 598, 1778053750487, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+66084', '启运丹田：开局签到至尊丹田', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20251004-1/f625b8e7f085794bedd389662b69991b.jpg', '2025', 9, 9, 56, 611, 1767060712227, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'lovedan.net+169944', '百炼成神第三季', '艾旦影视', 'https://ddmf.net/upload/vod/20251209-1/60a5bbe5419f3b38a564889ecf4c6236.jpg', '2025', 23, 24, 2, 1250, 1777962861934, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+53963', '凌天独尊', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250702-1/d4b488272a48a620a54c802290757e4c.jpg', '2025', 60, 60, 561, 604, 1768606413831, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+60965', '天相', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251015-1/8d1dc518543d06745947fd4924101610.jpg', '2025', 26, 26, 1110, 1241, 1775395397858, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+31685', '哪吒之魔童闹海', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250406-1/2f4246548ba76e946d634a786b212342.jpg', '2025', 1, 1, 8049, 8720, 1771776079154, '哪吒');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+78435', '深空彼岸', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20260116-1/51a0b513dbbb7a713bb79955607a61d8.jpg', '2026', 18, 19, 179, 1129, 1778163677163, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'yzzy+77027', '百炼成神3', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-12-09/17652519521.jpg', '2025', 23, 24, 1133, 1256, 1777963739815, '百炼成神');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+77824', '地狱模式～喜欢速通游戏的玩家在废设定异世界无双～', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20260110-1/aaa44ef25862a1d1b3fd056cab169434.jpg', '2026', 4, 8, 1419, 1433, 1769827517437, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+52316', '亡灵天灾：我抬手百万骨海', '爱奇艺', 'https://ikunpicvrfmn.com/upload/vod/20250605-1/38436f1878e29a8b5e5f3cc9be0ba51f.jpg', '2025', 135, 135, 327, 347, 1778678116563, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'ikunzy.com+64031', '遇强则强，我的修为无上限', 'iKun资源', 'https://tu.ikisfyigdaisasdad.com/upload/vod/20250605-1/1b78c25ce55b760594fb59152b1ee6ad.jpg', '2025', 116, 118, 293, 361, 1778163525235, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+8144', '炼气十万年', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250215-1/63a890d246187d98263572b145e1615a.jpg', '2023', 344, 344, 43, 752, 1778678680151, '炼气十万年');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+8955', '最强老祖已上线', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250411-1/4d64142bded9cef153365688e8ed9c8d.jpg', '2024', 83, 101, 173, 219, 1771370700851, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+52967', '神的欲望游戏', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250617-1/027635eaa900de5a8548cb657ef6b2a4.jpg', '2025', 110, 119, 208, 223, 1769901928041, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+60687', '武碎星河', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250820-1/067ab8048c12a9e434d4c4b2cfd17d1f.jpg', '2025', 60, 60, 552, 618, 1775437465196, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+49871', '全民诡异：开局掌握零元购', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250416-1/cda8675d6d7f072d96bb0943c69df871.jpg', '2025', 179, 195, 276, 329, 1777340426179, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'wolongzyw.com+80945', '全民御兽：开局山海经，我横扫全球', '卧龙资源', 'https://imgwolong.com/upload/vod/20250617-1/5b62a078f4c9d7c650b1332c68ee998a.jpg', '2025', 321, 327, 154, 160, 1777943728525, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzy+54055', '云深不知梦', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250705-1/8ec60d008a830eebe9f6e370a26f07c1.jpg', '2025', 18, 26, 1130, 1596, 1761657857316, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', '360zy.com+70246', '我夺舍了系统玩家动态漫画', '360 资源', 'https://www.imgzy360.com:7788/upload/vod/20241222-1/370f994745939243d074218980decb2a.jpg', '2024', 146, 146, 219, 225, 1768983780899, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'yzzy+77515', '全民模拟：开局打造专属金手指', '优质资源', 'https://pic3.yzzyimg.online/upload/vod/2025-12-26/202512261766711559.jpg', '2025', 96, 96, 9, 158, 1778680255152, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+39929', '寒冰末日：我屯了千亿物资', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20250409-1/beb6566410208fab896e56345c44ef50.webp', '2024', 87, 88, 255, 271, 1778296214396, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'iqiyizyapi.com+62097', '仙帝归来2025', '爱奇艺', 'https://tu.iqiyizyimg.com/upload/vod/20251027-1/f0fba78647fd174796cc47db997a23e7.jpg', '2025', 16, 16, 1070, 1157, 1769519244709, '');
INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', 'dyttzyapi.com+11964', '灵武大陆', '电影天堂', 'https://vip.dytt-img.com/upload/vod/20250224-1/3d2ca5f31024734f513975dc6363be0a.jpg', '2024', 176, 177, 570, 623, 1778296697556, '');

-- ============================================
-- 4. 搜索历史 (20 条，保留最近 20 条）
-- ============================================
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '炼气十万年', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '全民转职', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '末世重生', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '全民专职', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '全民专职奇迹锻造', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '百炼成神', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '末世重生：我靠开箱子问鼎巅峰', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '剑来', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '五哈', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '5哈', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '五', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '百炼', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '哪吒', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '魔童', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '死灵法师！', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '反套路斩神，我拒绝转职SSS级', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '天赋长生，我出卖寿命成神', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '最强老祖已上线', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '重生封神游戏之最强散人', unixepoch());
INSERT OR IGNORE INTO search_history (username, keyword, created_at)
VALUES ('7788', '死灵法师:我!无限军团横推万物', unixepoch());

-- ============================================
-- 5. 跳过片头片尾配置 (24 条）
-- ============================================
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'hongniuzy', '107794', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzy', '11964', 1, 121.451905, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'iqiyizyapi.com', '20260', 0, 0, -99.83617900000002);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzyapi.com', '59247', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'guangsuapi', '135932', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'jinyingzy.com', '77597', 0, 29.191961, -45.82217700000001);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'lovedan.net', '171806', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzy', '60687', 1, 111.887043, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzy', '67942', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'iqiyizyapi.com', '69030', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzy', '58764', 1, 113.096836, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'jszyapi.com', '90416', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzyapi.com', '76223', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'iqiyizyapi.com', '52316', 0, 0, -38.54272100000048);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'maotaizy', '107147', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'yzzy', '77515', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'jszyapi.com', '73549', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'jszyapi.com', '73544', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', '360zy.com', '90809', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzyapi.com', '72006', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzyapi.com', '80845', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'iqiyizyapi.com', '49871', 0, 0, -41.4381810000005);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'jszyapi.com', '70453', 0, 0, 0);
INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)
VALUES ('7788', 'dyttzy', '56877', 0, 0, 0);

-- ============================================
-- 6. 验证数据
-- ============================================
-- 检查用户
SELECT username, substr(password, 1, 20) || '...' as pwd_prefix, created_at FROM users WHERE username = '7788';

-- 检查收藏数量
SELECT COUNT(*) as favorites_count FROM favorites WHERE username = '7788';

-- 检查播放记录数量
SELECT COUNT(*) as play_records_count FROM play_records WHERE username = '7788';

-- 检查搜索历史数量
SELECT COUNT(*) as search_history_count FROM search_history WHERE username = '7788';

-- 检查跳过配置数量
SELECT COUNT(*) as skip_configs_count FROM skip_configs WHERE username = '7788';

