// 内置去广告规则（v4 / 还原稳健版）
//
// 设计原则（对齐 ergTV-main 默认逻辑，避免误伤正片）：
//  - 仅基于「URL 关键字 / 已知广告域名」精确匹配来移除广告分片。
//  - 绝不因「非主用 host」或「DISCONTINUITY 整块」误删正片分片
//    （否则会导致电影天堂音视频不同步、速播视频被拆切）。
//  - 保留 #EXT-X-DISCONTINUITY 标记本身（不整块移除），避免 A/V 错位。
//  - 仅跳过 SCTE-35 / CUE-OUT / CUE-IN 等明确广告标记。
//
// 作为「始终生效的基线」嵌入源码，不依赖 /admin 自定义代码是否保存成功。
// play/page.tsx 的 filterAdsFromM3U8 会先跑本函数，再叠加 /admin 自定义代码。

/* eslint-disable no-console */

export function builtInFilterAds(type: string, m3u8Content: string): string {
  try {
    if (!m3u8Content) return '';

    const lines = m3u8Content.split('\n');

    // ---- 0) 快速跳过非媒体播放列表 ----
    let hasExtInf = false;
    for (let li = 0; li < lines.length; li++) {
      if (
        lines[li].startsWith('#EXTINF:') ||
        lines[li].startsWith('#EXT-INF:')
      ) {
        hasExtInf = true;
        break;
      }
    }
    if (!hasExtInf) return m3u8Content;

    // ---- 1) 已知广告域名（精确 host 子串，不会误伤正片 CDN）----
    const AD_DOMAINS = [
      // 国际广告网络
      'doubleclick.net',
      'googlesyndication.com',
      'googleadservices.com',
      'adsterra.com',
      'propellerads.com',
      'popads.net',
      'revive-adserver.net',
      'mediaad.org',
      'exosrv.com',
      'srvtrck.com',
      'trafficjunky.com',
      'pubmatic.com',
      'rubiconproject.com',
      'openx.net',
      'smartadserver.com',
      // 爱奇艺官方广告
      'cupid.iqiyi.com',
      'afp.iqiyi.com',
      'ad.m.iqiyi.com',
      'policy.video.iqiyi.com',
      't7.cupid.iqiyi.com',
      'afp.iqiyicdnn.com',
      'video.iqiyicdnn.com/ad',
      // 猫眼 / 美团广告
      'ad.maoyan.com',
      'analytics.maoyan.com',
      's3plus.meituan.com',
      'report.meituan.com',
      'analytics.meituan.com',
      'stat.mafengwo.cn',
      // 博彩 / 色情广告（聚合站常见 —— 仅精确域名，不用的通配子串）
      'adcore.cn',
      'tt3418.com',
      'loot4.com',
      '7607558.com',
      '71044377.com',
      '681215.com',
      '481432.com',
      '847562.com',
      // 国内常见广告 CDN（明确域名）
      'adcdn.xyz',
      'adplayer.pro',
      'pinyin.cn',
      'adzsm.com',
    ];

    // ---- 2) 广告关键字（URL 子串，保守集合）----
    const AD_KEYWORDS = [
      // 通用（ergTV-main 默认）
      'sponsor',
      '/ad/',
      '/ads/',
      'advert',
      'advertisement',
      '/adjump',
      'redtraffic',
      'pre_roll',
      'mid_roll',
      'post_roll',
      'preroll',
      'midroll',
      'postroll',
      'adload',
      'adplay',
      'adshow',
      'adserve',
      // 爱奇艺广告特征
      'cupid.iqiyi',
      'afp.iqiyi',
      'ad.m.iqiyi',
      'policy.video.iqiyi',
      'iqiyi.com/ad',
      'iqiyicdnn.com',
      // 猫眼/美团
      'maoyan.com/ad',
      'maoyan.com/advert',
      'maoyan.com/tracking',
      'analytics.meituan',
      'meituan.com/ad',
      'meituan.com/advert',
      's3plus.meituan',
      'report.meituan',
      'stat.mafengwo',
      // 国际
      'doubleclick',
      'googlesyndication',
      'adservice',
      'vast',
      'vmap',
      'vpaid',
      // 博彩特征（聚合源注入的赌博广告，仅明确中文词）
      '棋牌',
      '棋牌游戏',
      '彩票',
      '博彩',
      '赌场',
      '百家乐',
      '7607558',
      '71044377',
      '681215',
      '481432',
      '847562',
    ];

    const isAdUrl = (u: string): boolean => {
      const low = u.toLowerCase();
      for (let i = 0; i < AD_DOMAINS.length; i++) {
        if (low.includes(AD_DOMAINS[i])) return true;
      }
      for (let j = 0; j < AD_KEYWORDS.length; j++) {
        if (low.includes(AD_KEYWORDS[j])) return true;
      }
      return false;
    };

    // ---- 3) 输出：仅对「命中广告域名/关键字」或「SCTE-35 广告块」的分片做移除 ----
    // 注意：不再做「非主用 host 当广告」「DISCONTINUITY 整块移除」
    // 「纯数字域名正则」「前贴时长检测」等激进规则，避免误伤正片。
    const out: string[] = [];
    let removed = 0;
    let i = 0;
    let inAdBlock = false;

    while (i < lines.length) {
      const line = lines[i];
      const s = line.trim();

      // 进入广告块（行业标准 SCTE-35 标记：CUE-OUT / DATERANGE+SCTE35）
      if (
        s.startsWith('#EXT-X-CUE-OUT') ||
        (s.startsWith('#EXT-X-DATERANGE') && s.includes('SCTE35'))
      ) {
        inAdBlock = true;
        i++;
        continue;
      }
      // 离开广告块
      if (s.startsWith('#EXT-X-CUE-IN')) {
        inAdBlock = false;
        i++;
        continue;
      }
      // 广告块内：跳过所有行（含 EXTINF + 对应 URL），不误伤正片
      if (inAdBlock) {
        if (s.startsWith('#EXTINF:') || s.startsWith('#EXT-INF:')) removed++;
        i++;
        continue;
      }

      // EXTINF 行：仅当下一行 URL 命中「广告域名/关键字」时才删除该分片
      if (s.startsWith('#EXTINF:') || s.startsWith('#EXT-INF:')) {
        const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
        if (next && !next.startsWith('#') && isAdUrl(next)) {
          i += 2; // 跳过 EXTINF + 对应 URL
          removed++;
          continue;
        }
      }

      out.push(line);
      i++;
    }

    if (removed > 0) {
      console.log(
        '[去广告] ' + type + ' 移除 ' + removed + ' 个广告片段 (保守模式)'
      );
    }
    return out.join('\n');
  } catch (e) {
    console.error('[内置去广告] 异常，降级返回原内容', e);
    return m3u8Content;
  }
}
