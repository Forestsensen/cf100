// 共享去广告规则模块
// 服务端 m3u8 路由与客户端 loader 统一引用，修改广告规则只需在此一处维护。

// 已知广告域名（精确匹配，避免误杀正常 CDN）——服务端 m3u8 路由使用
export const AD_DOMAINS: string[] = [
  // 欧美通用广告网络
  'doubleclick.net',
  'googlesyndication.com',
  'googleadservices.com',
  'adsterra.com',
  'propellerads.com',
  'popads.net',
  'revive-adserver.net',
  'mediaad.org',
  // 爱奇艺广告特征
  'cupid.iqiyi.com',
  'afp.iqiyi.com',
  'ad.m.iqiyi.com',
  'policy.video.iqiyi.com',
  't7.cupid.iqiyi.com',
  // 猫眼/美团广告特征
  'ad.maoyan.com',
  'analytics.maoyan.com',
  's3plus.meituan.com',
  'report.meituan.com',
  'analytics.meituan.com',
  'stat.mafengwo.cn',
];

// 已知死链/防盗链 CDN 节点（监控报告高频 4xx，跳过避免播放中断）——服务端 m3u8 路由使用
export const DEAD_CDN_DOMAINS: string[] = [
  'vv.jisuzyv.com',
  'vip.ffzy-plays.com',
  'ukzy.ukubf3.com',
  'v2.ppqrrs.com',
  'v10.ppqrrs.com',
];

// 分片/子 m3u8 的「走向」策略（2026-09 实测后反转）
//
// 旧策略：白名单直连（DIRECT_HOST_KEYWORDS），其余全部走 CF /segment 代理。
// 实测结论（10 个启用源 × 真实分片，见 probe_direct_vs_proxy.json）：
//   直连更快 10/10   代理更快 0/10
//   直连平均 2.75s   代理平均 5.30s（慢 93%）
//   其中 2 个源（暴风 s3.bfllvip.com / 量子 v.lzcdn28.com）代理直接 404，直连 200
//   10/10 源的分片响应都带 Access-Control-Allow-Origin，hls.js 浏览器可直连
//   加密源（猫眼/速播）的 #EXT-X-KEY 也带 ACAO，key 直连可行
// 另外直连不消耗 CF 请求数（一集 300~800 个分片），显著降低 Free 计划配额压力。
//
// 故反转为「默认直连」，仅下列「已知必须走代理」的 host 例外。
// 注意：本列表当前为空 —— 未发现必须走代理的源；如后续某源直连失败，
// 把其特征关键字加到这里即可（无需改动逻辑）。
export const PROXY_REQUIRED_KEYWORDS: string[] = [];

// 兼容保留：旧版直连白名单。现已不再作为判定依据（策略已反转为默认直连），
// 保留导出避免其他引用点报错；新代码请勿使用。
export const DIRECT_HOST_KEYWORDS: string[] = [
  'dytt', // 电影天堂（caiji.dyttzyapi.com / vip.dytt-tvs.com）
  'iqiyi', // 爱奇艺（iqiyizyapi.com）
  'yzzy', // 爱奇艺 CDN（api.yzzy-api.com / cdn.yzzy31-play.com）
];

// 广告关键字（子串匹配）——客户端 loader 使用
// 合并自原客户端规则与旧 filter-m3u8 服务端规则，避免三端分叉。
export const AD_KEYWORDS: string[] = [
  // 通用广告关键字
  'sponsor',
  '/ad/',
  '/ads/',
  'advert',
  'advertisement',
  '/adjump',
  'redtraffic',
  // 爱奇艺广告特征
  'cupid.iqiyi.com',
  'afp.iqiyi.com',
  'ad.m.iqiyi.com',
  'policy.video.iqiyi.com',
  't7.cupid.iqiyi.com',
  // 猫眼/美团广告特征
  'ad.maoyan.com',
  'analytics.maoyan.com',
  'maoyan.com/ad',
  'maoyan.com/advert',
  'maoyan.com/tracking',
  'analytics.meituan',
  'meituan.com/ad',
  'meituan.com/advert',
  'meituan.com/tracking',
  's3plus.meituan.com',
  'report.meituan.com',
  'stat.mafengwo',
  // 电影天堂/艾旦影视/优质资源 通用广告特征
  'pre_roll',
  'mid_roll',
  'post_roll',
  'preroll',
  'midroll',
  'postroll',
  // 广告 CDN 域名（子串）
  'doubleclick',
  'googlesyndication',
  'adservice',
];
