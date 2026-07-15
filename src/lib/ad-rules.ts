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

// 直连白名单：这些源的 TS/分片直连 CDN（国内直连快，省去 CF 中转、保白天高速）
// 匹配方式 = 分片 URL 主机名包含以下关键字（覆盖其 API 与 CDN 域名）
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
  // 广告追踪像素
  '.gif?',
  '.png?ad',
  // 广告 CDN 域名（子串）
  'doubleclick',
  'googlesyndication',
  'adservice',
];
