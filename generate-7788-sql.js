// Generate complete D1 SQL for user 7788 from Upstash data
const crypto = require('crypto');

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const ITERATIONS = 100_000;
const DIGEST = 'SHA-256';

function buf2hex(buf) {
  return Buffer.from(buf).toString('hex');
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const hash = crypto.pbkdf2Sync(password, salt, ITERATIONS, HASH_BYTES, DIGEST);
  return `pbkdf2:${buf2hex(salt)}:${buf2hex(hash)}`;
}

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// ==================== DATA FROM UPSTASH ====================

// Password for 7788 is "88888"
const PASSWORD = '88888';

// Favorites (hash: field -> value)
const favorites = [
  { key: "iqiyizyapi.com+16720", data: {"title":"灵武大陆","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250410-1/51841fb8e5806d0150c3882090bb6aeb.jpg","year":"2024","total_episodes":151,"save_time":1768269068719} },
  { key: "yzzy+77515", data: {"title":"全民模拟：开局打造专属金手指","source_name":"优质资源","cover":"https://pic3.yzzyimg.online/upload/vod/2025-12-26/202512261766711559.jpg","year":"2025","total_episodes":74,"save_time":1768269050604} },
  { key: "zy360+64627", data: {"title":"混沌天帝诀·动态漫","source_name":"360资源","year":"2024","cover":"https://www.imgzy360.com:7788/upload/vod/20240827-1/a3c5c9dd2b0da313c887c1b4f5d1d1a9.png","total_episodes":117,"save_time":1766542247800,"search_title":"混沌天帝诀·动态漫"} },
  { key: "iqiyizyapi.com+52330", data: {"title":"遇强则强，我的修为无上限","source_name":"爱奇艺","cover":"https://ikunpicvrfmn.com/upload/vod/20250605-1/1b78c25ce55b760594fb59152b1ee6ad.jpg","year":"2025","total_episodes":97,"save_time":1768269043253} },
  { key: "iqiyizyapi.com+58487", data: {"title":"绝世神皇","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250913-1/634e1d23fe19f60446c5e44818b50aea.jpg","year":"2025","total_episodes":40,"save_time":1768268961070} },
  { key: "yzzy+72146", data: {"title":"荒古恩仇录·破风篇","source_name":"优质资源","cover":"https://pic3.yzzyimg.online/upload/vod/2025-09-17/17580751861.jpg","year":"2025","total_episodes":40,"save_time":1766645879686,"search_title":"荒古恩仇录·破风篇"} },
  { key: "iqiyizyapi.com+39929", data: {"title":"寒冰末日：我屯了千亿物资","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250409-1/beb6566410208fab896e56345c44ef50.webp","year":"2024","total_episodes":73,"save_time":1766648776802,"search_title":"寒冰末日：我屯了千亿物资"} },
  { key: "iqiyizyapi.com+48448", data: {"title":"大主宰年番","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250408-1/e3afbd8d7cfdfb9eb96d8f7b75e61f22.jpg","year":"2023","total_episodes":59,"save_time":1768269074806} },
  { key: "iqiyizyapi.com+52966", data: {"title":"全民御兽：开局山海经，我横扫全球","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/248f81113fdd6dcc9f8d8d833236acc4.jpg","year":"2025","total_episodes":248,"save_time":1768269054863} },
  { key: "iqiyizyapi.com+52968", data: {"title":"神戒降临：最强异世界","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/cfe119eebe49e22b26e3198ba1a831e5.jpg","year":"2025","total_episodes":72,"save_time":1766651958326,"search_title":""} },
  { key: "iqiyizyapi.com+59760", data: {"title":"神在囧途","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250929-1/e2e234ec48a6667e7e21b8bd030ab75c.jpg","year":"2025","total_episodes":40,"save_time":1768269033680} },
  { key: "iqiyizyapi.com+52972", data: {"title":"我靠捡垃圾上王者","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/f8db234e022490b3a11fcc5578fe488e.jpg","total_episodes":70,"save_time":1768268975505} },
  { key: "dyttzyapi.com+68035", data: {"title":"现在就出发第三季","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251018-1/30d65d293ca640d6366be24b7524bb9e.jpg","year":"2025","total_episodes":57,"save_time":1766645888280,"search_title":"现在就出发第三季"} },
  { key: "lovedan.net+159891", data: {"title":"大象无形动态漫画","source_name":"艾旦影视","cover":"https://ddmf.net/upload/vod/20250718-1/ab0331797e5a9fbc69c5e4d0befdd775.jpg","year":"2025","total_episodes":63,"save_time":1768269061797} },
  { key: "dyttzyapi.com+63488", data: {"title":"天命大神皇","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250911-1/234a37ab335bc9e3771bbfc2c33b7390.jpg","total_episodes":40,"save_time":1768269046468} },
  { key: "iqiyizyapi.com+52967", data: {"title":"神的欲望游戏","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/027635eaa900de5a8548cb657ef6b2a4.jpg","year":"2025","total_episodes":112,"save_time":1768268956252} },
  { key: "lovedan.net+122720", data: {"title":"末世神级升级系统动态漫画第一季","source_name":"艾旦影视","cover":"https://ddmf.net//upload/vod/20240502-1/fbf80709ce8d0a264caf0e60429d0d71.jpg","year":"2024","total_episodes":100,"save_time":1768269064216} },
  { key: "ukuapi+58701", data: {"title":"全职法神！我即是规则 动态漫画","source_name":"U酷资源","year":"2025","cover":"https://img.ukuapi88.com/upload/vod/20250723-1/89405f5bc367aa013aa8ad290e80c6bf.jpg","total_episodes":40,"save_time":1766632779769,"search_title":"全职法神！我即是规则 动态漫画","type":"tv","remarks":"更新至40集"} },
  { key: "dyttzyapi.com+73243", data: {"title":"玄界之门","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251203-1/b3af93d4f008f7a95926050244424853.jpg","year":"2025","total_episodes":13,"save_time":1768268947222} },
  { key: "dbzy.tv+84114", data: {"title":"全民转职：无职的我终结了神明","source_name":"豆瓣资源","cover":"https://dbzy5.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg","year":"2025","total_episodes":46,"save_time":1766645876080,"search_title":"全民转职：无职的我终结了神明"} },
  { key: "yzzy+56285", data: {"title":"超凡进化动态漫画","source_name":"优质资源","year":"2024","cover":"https://pic3.yzzyimg.online/upload/vod/2024-07-19/17213666461.jpg","total_episodes":90,"save_time":1768268962346} },
  { key: "iqiyizyapi.com+8977", data: {"title":"炼气十万年","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250411-1/098397c4e4ff4a2347977acf15155e29.jpg","year":"2023","total_episodes":316,"save_time":1766645873332,"search_title":"炼气十万年"} },
  { key: "jinyingzy.com+77597", data: {"title":"死灵法师！我即是天灾","source_name":"金鹰点播","cover":"https://image.jinyingimage.com/cover/5a288002f09bd19f935d15e17899a9b3.jpg","year":"2024","total_episodes":215,"save_time":1768269049615} },
  { key: "dbzy+101937", data: {"title":"末世重生：我靠开箱子问鼎巅峰","source_name":"豆瓣资源","year":"2025","cover":"https://dbzy5.com/upload/vod/20250816-1/ac6a4cfbd3c689ecfcf5e92b5c072e4e.jpg","total_episodes":54,"save_time":1769234377457} },
  { key: "yzzy+70510", data: {"title":"神墓年番","source_name":"优质资源","cover":"https://pic3.yzzyimg.online/upload/vod/2025-08-08/17546210291.jpg","year":"2025","total_episodes":27,"save_time":1766632759968,"search_title":"神墓年番"} },
  { key: "iqiyizyapi.com+67244", data: {"title":"剑来第二季","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20251225-1/5c6ffada277f6e6387a66970fd7a74b9.jpg","year":"2025","total_episodes":9,"save_time":1768268945766} },
  { key: "iqiyizyapi.com+65035", data: {"title":"傲世丹神","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20251202-1/910ef915b5ead419ad0c583474d506a2.jpg","year":"2025","total_episodes":11,"save_time":1766648360217,"search_title":"傲世丹神"} },
  { key: "dyttzyapi.com+75297", data: {"title":"永生之太元仙府","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251220-1/322973deffe216cf3b01b50a25eba298.jpg","year":"2025","total_episodes":10,"save_time":1768269040153} },
  { key: "iqiyizyapi.com+67583", data: {"title":"光阴之外","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20251228-1/1423294eafec0ad41676b37316c09a42.jpg","year":"2025","total_episodes":8,"save_time":1768269047728} },
  { key: "dyttzyapi.com+72006", data: {"title":"九阳武神","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251122-1/e9ae983bf88da572fdcf6c22c32e39c3.jpg","year":"2025","total_episodes":15,"save_time":1768269042198} },
  { key: "dyttzyapi.com+77824", data: {"title":"地狱模式～喜欢速通游戏的玩家在废设定异世界无双～","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20260110-1/aaa44ef25862a1d1b3fd056cab169434.jpg","year":"2026","total_episodes":5,"save_time":1768269063264} },
  { key: "api.ukuapi88.com+55174", data: {"title":"从哥布林到哥布林神 动态漫画","source_name":"U酷资源","cover":"https://img.ukuapi88.com/upload/vod/20250415-1/c18cfec514274a00bafb4b18b9c2055c.jpg","year":"2025","total_episodes":46,"save_time":1767345945069,"search_title":""} },
  { key: "iqiyizyapi.com+56651", data: {"title":"武碎星河","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250817-1/0604d1dc0720d2576a7ddebfb9a5374b.jpg","year":"2025","total_episodes":52,"save_time":1766646409732,"search_title":"武碎星河"} },
  { key: "dyttzyapi.com+73937", data: {"title":"百炼成神3","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251209-1/48bf5a33af49170a2741b8ca1b0d610e.jpg","year":"2025","total_episodes":11,"save_time":1768269057869} },
  { key: "iqiyizyapi.com+53963", data: {"title":"凌天独尊","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250702-1/d4b488272a48a620a54c802290757e4c.jpg","year":"2025","total_episodes":60,"save_time":1768269059330} },
  { key: "iqiyizyapi.com+55230", data: {"title":"双生武魂","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250723-1/bd207ded120d87e691c9b49cf1a6512f.jpg","year":"2025","total_episodes":60,"save_time":1768268950875} },
  { key: "jinyingzy.com+93272", data: {"title":"反套路斩神，我拒绝转职SSS级","source_name":"金鹰点播","cover":"https://image.jinyingimage.com/cover/7dac40ce6a8cf652eeb730916b72352a.jpg","year":"2025","total_episodes":91,"save_time":1768269055879} },
  { key: "tyyszy.com+48300", data: {"title":"天命大神皇","source_name":"天涯影视","cover":"http://tyyswimg.com/upload/vod/20250912-1/48f33d16e6e6aa387a762bf2056b098f.jpg","year":"2025","total_episodes":40,"save_time":1767535591409} },
  { key: "mtzy.me+84114", data: {"title":"全民转职：无职的我终结了神明","source_name":"茅台资源","cover":"https://mtzy2.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg","year":"2025","total_episodes":46,"save_time":1768269035224} },
  { key: "iqiyizyapi.com+59837", data: {"title":"谷围南亭第一卷国语","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250930-1/e6d6483a59f42d61d9305ebe32ec36dc.jpg","year":"2025","total_episodes":16,"save_time":1766652203830,"search_title":""} },
  { key: "www.maoyanzy.com+143880", data: {"title":"全职法神！我即是规则","source_name":"猫眼资源","cover":"http://www.maoyanimg.top/upload/vod/20250723-26/7a33a2b7eaa6d6e2e7444bcc2fe4e130.jpg","year":"2025","total_episodes":47,"save_time":1766645878340,"search_title":"全职法神！我即是规则"} },
  { key: "dyttzyapi.com+67942", data: {"title":"天相","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251018-1/b606dbd991ad4195044ad4266fd84685.jpg","year":"2025","total_episodes":19,"save_time":1768269036040} },
  { key: "yzzy+78394", data: {"title":"天赋长生，我出卖寿命成神动态漫画","source_name":"优质资源","cover":"https://pic3.yzzyimg.online/upload/vod/2026-01-01/202601011767230014.jpg","year":"2025","total_episodes":80,"save_time":1768269051864} },
  { key: "iqiyizyapi.com+59441", data: {"title":"大唐乘风录","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250925-1/3f2cada4e417d2ff0aa51c2f4d22f897.jpg","year":"2025","total_episodes":21,"save_time":1766649959515,"search_title":""} },
  { key: "iqiyizyapi.com+64560", data: {"title":"玄界之门","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20251126-1/62cdf05eb301fa4741a0c74d0adf3791.jpg","year":"2025","total_episodes":12,"save_time":1766645874649,"search_title":"玄界之门"} },
  { key: "yzzy+72721", data: {"title":"转职阎王：我执掌了生死簿动态漫画","source_name":"优质资源","year":"2025","cover":"https://pic3.yzzyimg.online/upload/vod/2025-10-01/202510011759311031.jpg","total_episodes":36,"save_time":1768268948740} },
];

// Play Records (hash: field -> value)
const playRecords = [
  { key: "iqiyizyapi.com+60310", data: {"title":"一拳超人第三季","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20251006-1/4179a693b2a0deba0266cc631ef529da.jpg","index":11,"total_episodes":13,"original_episodes":13,"play_time":1113,"total_time":1441,"save_time":1767073908223,"search_title":"","remarks":"更新至12集"} },
  { key: "lovedan.net+122720", data: {"title":"末世神级升级系统动态漫画第一季","source_name":"艾旦影视","year":"2024","cover":"https://ddmf.net//upload/vod/20240502-1/fbf80709ce8d0a264caf0e60429d0d71.jpg","index":100,"total_episodes":100,"play_time":303,"total_time":346,"save_time":1769566555575,"search_title":""} },
  { key: "xinlangapi.com+129368", data: {"title":"死灵法师！我即是天灾","source_name":"新浪资源","cover":"https://xinlangtupian.com/cover/5a288002f09bd19f935d15e17899a9b3.jpg","index":250,"total_episodes":253,"play_time":277,"year":"2024","total_time":321,"save_time":1777853725220,"search_title":""} },
  { key: "iqiyizyapi.com+52968", data: {"title":"神戒降临：最强异世界","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/cfe119eebe49e22b26e3198ba1a831e5.jpg","index":72,"total_episodes":72,"play_time":332,"total_time":398,"save_time":1768344833766,"search_title":""} },
  { key: "lovedan.net+159891", data: {"title":"大象无形动态漫画","source_name":"艾旦影视","year":"2025","cover":"https://ddmf.net/upload/vod/20250718-1/ab0331797e5a9fbc69c5e4d0befdd775.jpg","index":63,"total_episodes":63,"play_time":328,"total_time":365,"save_time":1769605466781,"search_title":""} },
  { key: "iqiyizyapi.com+58487", data: {"title":"绝世神皇","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250913-1/634e1d23fe19f60446c5e44818b50aea.jpg","index":40,"total_episodes":40,"play_time":553,"total_time":596,"save_time":1768798137455,"search_title":""} },
  { key: "iqiyizyapi.com+58861", data: {"title":"荒古恩仇录·破风篇","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250917-1/a4dee95aa4676fb4bd5b72fc16468bad.jpg","index":40,"total_episodes":40,"play_time":574,"total_time":646,"save_time":1768658455293,"search_title":""} },
  { key: "dyttzyapi.com+75297", data: {"title":"永生之太元仙府","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251220-1/322973deffe216cf3b01b50a25eba298.jpg","index":12,"total_episodes":16,"play_time":8,"year":"2025","total_time":1489,"save_time":1771794570180,"search_title":""} },
  { key: "jszyapi.com+90416", data: {"title":"反套路斩神，我拒绝转职SSS级","source_name":"极速资源","year":"2025","cover":"https://img.jisuimage.com/cover/7dac40ce6a8cf652eeb730916b72352a.jpg","index":122,"total_episodes":122,"play_time":152,"total_time":153,"save_time":1775876927488,"search_title":""} },
  { key: "yzzy+56285", data: {"title":"超凡进化动态漫画","source_name":"优质资源","year":"2024","cover":"https://pic3.yzzyimg.online/upload/vod/2024-07-19/17213666461.jpg","index":90,"total_episodes":90,"original_episodes":90,"play_time":223,"total_time":413,"save_time":1767422919475,"search_title":"","remarks":"更新至90集"} },
  { key: "dyttzyapi.com+80845", data: {"title":"哈哈哈哈哈第六季","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20260401-1/57914e6e00d6f2559a09706f5a22ac41.webp","index":29,"total_episodes":32,"play_time":5195,"year":"2026","total_time":5409,"save_time":1778336055562,"search_title":""} },
  { key: "iqiyizyapi.com+55230", data: {"title":"双生武魂","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250723-1/bd207ded120d87e691c9b49cf1a6512f.jpg","index":60,"total_episodes":60,"play_time":410,"total_time":650,"save_time":1768865973254,"search_title":""} },
  { key: "dbzy+101937", data: {"title":"末世重生：我靠开箱子问鼎巅峰","source_name":"豆瓣资源","year":"2025","cover":"https://dbzy5.com/upload/vod/20250816-1/ac6a4cfbd3c689ecfcf5e92b5c072e4e.jpg","index":54,"total_episodes":54,"play_time":338,"total_time":350,"save_time":1766498534926,"search_title":"","original_episodes":51} },
  { key: "jszyapi.com+70453", data: {"title":"末世重生：我靠开箱子问鼎巅峰","source_name":"极速资源","year":"2025","cover":"https://img.jisuimage.com/cover/e1688cd9baac409414fac365110dd2be.jpg","index":76,"total_episodes":76,"play_time":236,"total_time":242,"save_time":1778375894776,"search_title":"末世重生"} },
  { key: "dyttzyapi.com+59247", data: {"title":"神墓年番","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250808-1/75f8ddc3d5c7ff862b58a7d95387ec3b.jpg","index":41,"total_episodes":41,"play_time":1111,"total_time":1229,"save_time":1778376958191,"search_title":""} },
  { key: "dyttzyapi.com+69609", data: {"title":"全能高手","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20251101-1/5b40b3da853673eb90e8dd0b252e12f8.jpg","index":20,"total_episodes":20,"play_time":543,"total_time":744,"save_time":1775462027466,"search_title":""} },
  { key: "dyttzyapi.com+63488", data: {"title":"天命大神皇","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250911-1/234a37ab335bc9e3771bbfc2c33b7390.jpg","index":40,"total_episodes":40,"play_time":587,"total_time":626,"save_time":1768214155623,"search_title":""} },
  { key: "jszyapi.com+73544", data: {"title":"末日狠人：开局囤积万亿物资 动态漫画","source_name":"极速资源","cover":"https://img.jisuimage.com/cover/e261d6435a36803e1c6e6e6c019eb082.jpg","index":60,"total_episodes":61,"play_time":246,"year":"2025","total_time":279,"save_time":1778297680642,"search_title":""} },
  { key: "dyttzyapi.com+65035", data: {"title":"大唐乘风录","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250925-1/50ac71b775e6eb9de011df20c8d5d2a7.jpg","index":26,"total_episodes":26,"play_time":1117,"total_time":1231,"save_time":1776602925750,"search_title":""} },
  { key: "yzzy+72721", data: {"title":"转职阎王：我执掌了生死簿动态漫画","source_name":"优质资源","year":"2025","cover":"https://pic3.yzzyimg.online/upload/vod/2025-10-01/202510011759311031.jpg","index":36,"total_episodes":36,"play_time":143,"total_time":213,"save_time":1768343991557,"search_title":""} },
  { key: "iqiyizyapi.com+59760", data: {"title":"神在囧途","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250929-1/e2e234ec48a6667e7e21b8bd030ab75c.jpg","index":40,"total_episodes":40,"play_time":554,"total_time":655,"save_time":1770890643255,"search_title":""} },
  { key: "dyttzyapi.com+73243", data: {"title":"玄界之门","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20251203-1/b3af93d4f008f7a95926050244424853.jpg","index":26,"total_episodes":26,"play_time":1126,"total_time":1267,"save_time":1778167403955,"search_title":""} },
  { key: "dyttzyapi.com+76153", data: {"title":"山海经密码","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20251227-1/0b11155e4406025817f62e869f48d587.jpg","index":13,"total_episodes":13,"play_time":1082,"total_time":1212,"save_time":1776260120492,"search_title":""} },
  { key: "dyttzyapi.com+76223", data: {"title":"光阴之外","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251228-1/78a5ae2130d1ca70a8a89a0358411ab6.jpg","index":20,"total_episodes":21,"play_time":1356,"year":"2025","total_time":1530,"save_time":1778162965798,"search_title":""} },
  { key: "iqiyizyapi.com+53046", data: {"title":"我，进化，恶魔","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250618-1/3de886c1ccdbf965fb3f7bff6314def9.jpg","index":38,"total_episodes":38,"play_time":299,"total_time":329,"save_time":1769267145706,"search_title":""} },
  { key: "iqiyizyapi.com+69030", data: {"title":"全职法神！我即是规则","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20260113-1/336a79838b22b414123c1904de74aebc.jpg","index":73,"total_episodes":75,"play_time":220,"year":"2025","total_time":334,"save_time":1777965701749,"search_title":""} },
  { key: "360zy.com+90809", data: {"title":"大主宰年番","source_name":"360 资源","year":"2023","cover":"https://www.imgzy360.com:7788/upload/vod/20260206-1/461e737c3ed3f92aa513c26286e4726a.webp","index":72,"total_episodes":72,"play_time":20,"total_time":1245,"save_time":1778379313650,"search_title":""} },
  { key: "jszyapi.com+73549", data: {"title":"从哥布林到哥布林神 动态漫画","source_name":"极速资源","year":"2025","cover":"https://img.jisuimage.com/cover/b5419639a68181f34ce2a65908a4008e.jpg","index":61,"total_episodes":61,"play_time":7,"total_time":281,"save_time":1778678220566,"search_title":""} },
  { key: "iqiyizyapi.com+54927", data: {"title":"龙族第二季","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250718-1/f10e4b336ca8fae91d9589d16f2e762b.jpg","index":6,"total_episodes":24,"play_time":1380,"total_time":1453,"save_time":1767193490210,"search_title":"","original_episodes":24} },
  { key: "dyttzyapi.com+79338", data: {"title":"史上最强炼体老祖","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20260126-1/0b45029f4820e2cc2deaf78f545c2568.webp","index":4,"total_episodes":17,"play_time":449,"year":"2026","total_time":465,"save_time":1769743795808,"search_title":""} },
  { key: "mtzy.me+84114", data: {"title":"全民转职：无职的我终结了神明","source_name":"茅台资源","year":"2025","cover":"https://mtzy2.com/upload/vod/20250409-1/90b54b5206a951ed219b7574fdb7253a.jpg","index":46,"total_episodes":46,"play_time":255,"total_time":281,"save_time":1769812682715,"search_title":""} },
  { key: "tyyszy.com+52386", data: {"title":"超凡进化","source_name":"天涯影视","year":"2025","cover":"http://tyyswimg.com/upload/vod/20251230-1/7bcfb90ccfbd8a6e72b7d931007348aa.jpg","index":14,"total_episodes":14,"play_time":756,"total_time":902,"save_time":1767278843826,"search_title":"超凡进化","original_episodes":14} },
  { key: "dyttzy+54308", data: {"title":"废渊战鬼","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20250706-1/5ef763e893f71a738ed5eb910422c060.jpg","index":5,"total_episodes":24,"play_time":1208,"year":"2025","total_time":1420,"save_time":1761916298342,"search_title":""} },
  { key: "ikunzy.com+67119", data: {"title":"天赋长生，我出卖寿命成神","source_name":"iKun资源","year":"2025","cover":"https://tu.ikisfyigdaisasdad.com/upload/vod/20260116-1/a22173cb03a5add241bd5b2cb20df985.jpg","index":114,"total_episodes":114,"play_time":139,"total_time":139,"save_time":1778164318876,"search_title":""} },
  { key: "iqiyizyapi.com+52972", data: {"title":"我靠捡垃圾上王者","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/f8db234e022490b3a11fcc5578fe488e.jpg","index":70,"total_episodes":70,"play_time":266,"total_time":274,"save_time":1768269030560,"search_title":""} },
  { key: "360zy.com+64627", data: {"title":"混沌天帝诀·动态漫","source_name":"360 资源","year":"2024","cover":"https://www.imgzy360.com:7788/upload/vod/20240827-1/a3c5c9dd2b0da313c887c1b4f5d1d1a9.png","index":134,"total_episodes":134,"play_time":194,"total_time":231,"save_time":1776234560042,"search_title":""} },
  { key: "iqiyizyapi.com+65035", data: {"title":"傲世丹神","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20251202-1/910ef915b5ead419ad0c583474d506a2.jpg","index":12,"total_episodes":12,"play_time":1075,"total_time":1156,"save_time":1771543063205,"search_title":""} },
  { key: "dyttzy+58764", data: {"title":"万剑王座","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250804-1/96f67d4e64e8a9293728f6f8c264b58b.jpg","index":40,"total_episodes":40,"play_time":551,"total_time":638,"save_time":1765547324187,"search_title":"","original_episodes":39} },
  { key: "iqiyizyapi.com+43236", data: {"title":"宗门里除了我都是卧底","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250408-1/33fed2afbd9bb7be43abfa20559ed207.jpg","index":149,"total_episodes":151,"play_time":425,"year":"2024","total_time":429,"save_time":1778050801131,"search_title":""} },
  { key: "yzzy+77496", data: {"title":"剑来第二季","source_name":"优质资源","year":"2025","cover":"https://pic3.yzzyimg.online/upload/vod/2025-12-25/202512251766628696.jpg","index":27,"total_episodes":27,"play_time":1795,"total_time":1927,"save_time":1777167435022,"search_title":"剑来"} },
  { key: "jinyingzy+71328", data: {"title":"百斩屠神 动态漫画","source_name":"金鹰点播","year":"2025","cover":"https://image.jinyingimage.com/cover/9e0e40a51b6ed794dbcfbd46410ba102.jpg","index":73,"total_episodes":73,"original_episodes":73,"play_time":98,"total_time":319,"save_time":1761012128328,"search_title":"百斩屠神","remarks":"第73集"} },
  { key: "iqiyizyapi.com+59837", data: {"title":"谷围南亭第一卷国语","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250930-1/e6d6483a59f42d61d9305ebe32ec36dc.jpg","index":16,"total_episodes":16,"original_episodes":16,"play_time":1044,"total_time":1227,"save_time":1767401405038,"search_title":"","remarks":"全16集","douban_id":36395136} },
  { key: "dyttzyapi.com+72006", data: {"title":"九阳武神","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20251122-1/e9ae983bf88da572fdcf6c22c32e39c3.jpg","index":27,"total_episodes":28,"play_time":589,"year":"2025","total_time":598,"save_time":1778053750487,"search_title":""} },
  { key: "dyttzyapi.com+66084", data: {"title":"启运丹田：开局签到至尊丹田","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20251004-1/f625b8e7f085794bedd389662b69991b.jpg","index":9,"total_episodes":9,"original_episodes":9,"play_time":56,"total_time":611,"save_time":1767060712227,"search_title":"","remarks":"更新至第09集"} },
  { key: "lovedan.net+169944", data: {"title":"百炼成神第三季","source_name":"艾旦影视","cover":"https://ddmf.net/upload/vod/20251209-1/60a5bbe5419f3b38a564889ecf4c6236.jpg","index":23,"total_episodes":24,"play_time":2,"year":"2025","total_time":1250,"save_time":1777962861934,"search_title":""} },
  { key: "iqiyizyapi.com+53963", data: {"title":"凌天独尊","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20250702-1/d4b488272a48a620a54c802290757e4c.jpg","index":60,"total_episodes":60,"play_time":561,"total_time":604,"save_time":1768606413831,"search_title":""} },
  { key: "iqiyizyapi.com+60965", data: {"title":"天相","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20251015-1/8d1dc518543d06745947fd4924101610.jpg","index":26,"total_episodes":26,"play_time":1110,"total_time":1241,"save_time":1775395397858,"search_title":""} },
  { key: "dyttzyapi.com+31685", data: {"title":"哪吒之魔童闹海","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250406-1/2f4246548ba76e946d634a786b212342.jpg","index":1,"total_episodes":1,"play_time":8049,"total_time":8720,"save_time":1771776079154,"search_title":"哪吒"} },
  { key: "dyttzyapi.com+78435", data: {"title":"深空彼岸","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20260116-1/51a0b513dbbb7a713bb79955607a61d8.jpg","index":18,"total_episodes":19,"play_time":179,"year":"2026","total_time":1129,"save_time":1778163677163,"search_title":""} },
  { key: "yzzy+77027", data: {"title":"百炼成神3","source_name":"优质资源","cover":"https://pic3.yzzyimg.online/upload/vod/2025-12-09/17652519521.jpg","index":23,"total_episodes":24,"play_time":1133,"year":"2025","total_time":1256,"save_time":1777963739815,"search_title":"百炼成神"} },
  { key: "dyttzyapi.com+77824", data: {"title":"地狱模式～喜欢速通游戏的玩家在废设定异世界无双～","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20260110-1/aaa44ef25862a1d1b3fd056cab169434.jpg","index":4,"total_episodes":8,"play_time":1419,"year":"2026","total_time":1433,"save_time":1769827517437,"search_title":""} },
  { key: "iqiyizyapi.com+52316", data: {"title":"亡灵天灾：我抬手百万骨海","source_name":"爱奇艺","year":"2025","cover":"https://ikunpicvrfmn.com/upload/vod/20250605-1/38436f1878e29a8b5e5f3cc9be0ba51f.jpg","index":135,"total_episodes":135,"play_time":327,"total_time":347,"save_time":1778678116563,"search_title":""} },
  { key: "ikunzy.com+64031", data: {"title":"遇强则强，我的修为无上限","source_name":"iKun资源","cover":"https://tu.ikisfyigdaisasdad.com/upload/vod/20250605-1/1b78c25ce55b760594fb59152b1ee6ad.jpg","index":116,"total_episodes":118,"play_time":293,"year":"2025","total_time":361,"save_time":1778163525235,"search_title":""} },
  { key: "dyttzyapi.com+8144", data: {"title":"炼气十万年","source_name":"电影天堂","year":"2023","cover":"https://vip.dytt-img.com/upload/vod/20250215-1/63a890d246187d98263572b145e1615a.jpg","index":344,"total_episodes":344,"play_time":43,"total_time":752,"save_time":1778678680151,"search_title":"炼气十万年"} },
  { key: "iqiyizyapi.com+8955", data: {"title":"最强老祖已上线","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250411-1/4d64142bded9cef153365688e8ed9c8d.jpg","index":83,"total_episodes":101,"play_time":173,"year":"2024","total_time":219,"save_time":1771370700851,"search_title":""} },
  { key: "iqiyizyapi.com+52967", data: {"title":"神的欲望游戏","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250617-1/027635eaa900de5a8548cb657ef6b2a4.jpg","index":110,"total_episodes":119,"play_time":208,"year":"2025","total_time":223,"save_time":1769901928041,"search_title":""} },
  { key: "dyttzyapi.com+60687", data: {"title":"武碎星河","source_name":"电影天堂","year":"2025","cover":"https://vip.dytt-img.com/upload/vod/20250820-1/067ab8048c12a9e434d4c4b2cfd17d1f.jpg","index":60,"total_episodes":60,"play_time":552,"total_time":618,"save_time":1775437465196,"search_title":""} },
  { key: "iqiyizyapi.com+49871", data: {"title":"全民诡异：开局掌握零元购","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250416-1/cda8675d6d7f072d96bb0943c69df871.jpg","index":179,"total_episodes":195,"play_time":276,"year":"2025","total_time":329,"save_time":1777340426179,"search_title":""} },
  { key: "wolongzyw.com+80945", data: {"title":"全民御兽：开局山海经，我横扫全球","source_name":"卧龙资源","cover":"https://imgwolong.com/upload/vod/20250617-1/5b62a078f4c9d7c650b1332c68ee998a.jpg","index":321,"total_episodes":327,"play_time":154,"year":"2025","total_time":160,"save_time":1777943728525,"search_title":""} },
  { key: "dyttzy+54055", data: {"title":"云深不知梦","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20250705-1/8ec60d008a830eebe9f6e370a26f07c1.jpg","index":18,"total_episodes":26,"play_time":1130,"year":"2025","total_time":1596,"save_time":1761657857316,"search_title":""} },
  { key: "360zy.com+70246", data: {"title":"我夺舍了系统玩家动态漫画","source_name":"360 资源","year":"2024","cover":"https://www.imgzy360.com:7788/upload/vod/20241222-1/370f994745939243d074218980decb2a.jpg","index":146,"total_episodes":146,"play_time":219,"total_time":225,"save_time":1768983780899,"search_title":""} },
  { key: "yzzy+77515", data: {"title":"全民模拟：开局打造专属金手指","source_name":"优质资源","year":"2025","cover":"https://pic3.yzzyimg.online/upload/vod/2025-12-26/202512261766711559.jpg","index":96,"total_episodes":96,"play_time":9,"total_time":158,"save_time":1778680255152,"search_title":""} },
  { key: "iqiyizyapi.com+39929", data: {"title":"寒冰末日：我屯了千亿物资","source_name":"爱奇艺","cover":"https://tu.iqiyizyimg.com/upload/vod/20250409-1/beb6566410208fab896e56345c44ef50.webp","index":87,"total_episodes":88,"play_time":255,"year":"2024","total_time":271,"save_time":1778296214396,"search_title":""} },
  { key: "iqiyizyapi.com+62097", data: {"title":"仙帝归来2025","source_name":"爱奇艺","year":"2025","cover":"https://tu.iqiyizyimg.com/upload/vod/20251027-1/f0fba78647fd174796cc47db997a23e7.jpg","index":16,"total_episodes":16,"play_time":1070,"total_time":1157,"save_time":1769519244709,"search_title":""} },
  { key: "dyttzyapi.com+11964", data: {"title":"灵武大陆","source_name":"电影天堂","cover":"https://vip.dytt-img.com/upload/vod/20250224-1/3d2ca5f31024734f513975dc6363be0a.jpg","index":176,"total_episodes":177,"play_time":570,"year":"2024","total_time":623,"save_time":1778296697556,"search_title":""} },
];

// Skip configs (hash: field -> value, key format: source+id)
const skipConfigs = [
  { key: "hongniuzy+107794", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzy+11964", data: {"enable":true,"intro_time":121.451905,"outro_time":0} },
  { key: "iqiyizyapi.com+20260", data: {"enable":false,"intro_time":0,"outro_time":-99.83617900000002} },
  { key: "dyttzyapi.com+59247", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "guangsuapi+135932", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "jinyingzy.com+77597", data: {"enable":false,"intro_time":29.191961,"outro_time":-45.82217700000001} },
  { key: "lovedan.net+171806", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzy+60687", data: {"enable":true,"intro_time":111.887043,"outro_time":0} },
  { key: "dyttzy+67942", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "iqiyizyapi.com+69030", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzy+58764", data: {"enable":true,"intro_time":113.096836,"outro_time":0} },
  { key: "jszyapi.com+90416", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzyapi.com+76223", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "iqiyizyapi.com+52316", data: {"enable":false,"intro_time":0,"outro_time":-38.54272100000048} },
  { key: "maotaizy+107147", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "yzzy+77515", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "jszyapi.com+73549", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "jszyapi.com+73544", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "360zy.com+90809", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzyapi.com+72006", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzyapi.com+80845", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "iqiyizyapi.com+49871", data: {"enable":false,"intro_time":0,"outro_time":-41.4381810000005} },
  { key: "jszyapi.com+70453", data: {"enable":false,"intro_time":0,"outro_time":0} },
  { key: "dyttzy+56877", data: {"enable":false,"intro_time":0,"outro_time":0} },
];

// Search history (list)
const searchHistory = [
  "炼气十万年","全民转职","末世重生","全民专职","全民专职奇迹锻造","百炼成神","末世重生：我靠开箱子问鼎巅峰","剑来","五哈","5哈","五","百炼","哪吒","魔童","死灵法师！","反套路斩神，我拒绝转职SSS级","天赋长生，我出卖寿命成神","最强老祖已上线","重生封神游戏之最强散人","死灵法师:我!无限军团横推万物"
];

// ==================== GENERATE SQL ====================

async function main() {
  const pwdHash = await hashPassword(PASSWORD);

  let sql = `-- ============================================================
-- 完整恢复用户 7788 的数据到 MoonTV D1 数据库
-- 数据来源：Upstash Redis（通过 REST API 提取）
-- 密码：88888（PBKDF2-SHA256 哈希，本次生成）
--
-- 执行方式：
--   1. 打开 Cloudflare Dashboard
--   2. 进入 Workers & Pages > D1 SQL Database
--   3. 选择数据库
--   4. 点击 "Console" 标签
--   5. 粘贴执行以下 SQL（可分批执行）
--
-- 生成时间：${new Date().toISOString()}
-- ============================================================

BEGIN TRANSACTION;

-- ============================================
-- 1. 插入用户 7788（如果已存在则更新密码）
-- ============================================
INSERT OR IGNORE INTO users (username, password, created_at)
VALUES (
  '7788',
  '${pwdHash}',
  unixepoch()
);
-- 如果用户已存在，更新密码：
UPDATE users SET password = '${pwdHash}' WHERE username = '7788';

-- ============================================
-- 2. 收藏 (${favorites.length} 条）
-- ============================================
`;

  for (const fav of favorites) {
    const d = fav.data;
    sql += `INSERT OR IGNORE INTO favorites (username, key, title, source_name, cover, year, total_episodes, save_time)
VALUES ('7788', ${escapeSql(fav.key)}, ${escapeSql(d.title)}, ${escapeSql(d.source_name)}, ${escapeSql(d.cover)}, ${escapeSql(d.year || '')}, ${d.total_episodes}, ${d.save_time});\n`;
  }

  sql += `
-- ============================================
-- 3. 播放记录 (${playRecords.length} 条）
-- ============================================
`;

  for (const pr of playRecords) {
    const d = pr.data;
    const st = d.search_title || '';
    sql += `INSERT OR IGNORE INTO play_records (username, key, title, source_name, cover, year, index_episode, total_episodes, play_time, total_time, save_time, search_title)
VALUES ('7788', ${escapeSql(pr.key)}, ${escapeSql(d.title)}, ${escapeSql(d.source_name)}, ${escapeSql(d.cover)}, ${escapeSql(d.year || '')}, ${d.index}, ${d.total_episodes}, ${d.play_time}, ${d.total_time}, ${d.save_time}, ${escapeSql(st)});\n`;
  }

  sql += `
-- ============================================
-- 4. 搜索历史 (${searchHistory.length} 条，保留最近 20 条）
-- ============================================
`;

  // Take last 20 (most recent)
  const recentSearch = searchHistory.slice(-20);
  for (const kw of recentSearch) {
    sql += `INSERT OR IGNORE INTO search_history (username, keyword, created_at)\nVALUES ('7788', ${escapeSql(kw)}, unixepoch());\n`;
  }

  sql += `
-- ============================================
-- 5. 跳过片头片尾配置 (${skipConfigs.length} 条）
-- ============================================
`;

  for (const sc of skipConfigs) {
    const d = sc.data;
    const parts = sc.key.split('+');
    const source = parts[0];
    const idVideo = parts.slice(1).join('+');
    const enable = d.enable ? 1 : 0;
    const intro = d.intro_time;
    const outro = d.outro_time;
    sql += `INSERT OR IGNORE INTO skip_configs (username, source, id_video, enable, intro_time, outro_time)\nVALUES ('7788', ${escapeSql(source)}, ${escapeSql(idVideo)}, ${enable}, ${intro}, ${outro});\n`;
  }

  sql += `
COMMIT;

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
`;

  console.log(sql);
}

main().catch(console.error);
