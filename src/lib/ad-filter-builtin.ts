// 内置去广告规则（v3）—— 强化版，覆盖 11 源站 + 爱奇艺前贴
//
// 作为「始终生效的基线」嵌入源码，不依赖 /admin 自定义代码是否保存成功。
// play/page.tsx 的 filterAdsFromM3U8 会先跑本函数，再叠加 /admin 自定义代码。
//
// v3 核心：基于首个 #EXT-X-DISCONTINUITY 定位前贴广告块，整块移除
// （多段短分片前贴，如爱奇艺 2:08 赌博前贴 ≈10×12.8s 也能拦），
// 保留 DISCONTINUITY 标记本身避免 A/V 不同步。

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

    // ---- 1) 统计主用 CDN（出现最多的绝对 URL host）----
    const hostCount: Record<string, number> = {};
    for (let x = 0; x < lines.length; x++) {
      const ls = lines[x].trim();
      if (ls && !ls.startsWith('#')) {
        try {
          const h = new URL(ls).hostname.toLowerCase();
          if (h) hostCount[h] = (hostCount[h] || 0) + 1;
        } catch {
          /* ignore */
        }
      }
    }
    let mainHost: string | null = null;
    let max = 0;
    for (const k in hostCount) {
      if (hostCount[k] > max) {
        max = hostCount[k];
        mainHost = k;
      }
    }

    // ---- 2) 已知广告域名（覆盖爱奇艺/猫眼/欧美/博彩广告网）----
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
      // 博彩 / 色情广告（聚合站常见 —— 持续补充新域名）
      '.bet.',
      '.casino.',
      '.slot.',
      '.gamble.',
      '.poker.',
      '7607558.com',
      '71044377.com',
      'tt3418.com',
      'loot4.com',
      'adcore.cn',
      // 截图实捕域名（开元棋牌/PG电子等赌博前贴）
      '681215.com',
      '481432.com',
      '847562.com',
      // 国内常见广告 CDN
      'adcdn.xyz',
      'adplayer.pro',
      'advideo.',
      'playad.',
      'adv.',
      '/ad/',
      '.ad.',
      '_ad.',
      'pinyin.cn',
      'adzsm.com',
    ];

    // ---- 3) 广告关键字（URL 子串）----
    const AD_KEYWORDS = [
      // 通用
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
      // 博彩特征（聚合源注入的赌博广告）
      '棋牌',
      '棋牌游戏',
      '彩票',
      '博彩',
      '赌场',
      '百家乐',
      'qp',
      'dubo',
      'duobo',
      'cpzy',
      '7607558',
      '71044377',
      // 截图实捕（开元棋牌/PG电子）
      '681215',
      '481432',
      '847562',
      // 通用数字域名赌博模式（5-7位纯数字.com/.top/.cc/.app）
      // 注意：不在此处做正则，由调用方按需扩展
    ];

    const isAdUrl = (u: string): boolean => {
      const low = u.toLowerCase();
      for (let i = 0; i < AD_DOMAINS.length; i++) {
        if (low.includes(AD_DOMAINS[i])) return true;
      }
      for (let j = 0; j < AD_KEYWORDS.length; j++) {
        if (low.includes(AD_KEYWORDS[j])) return true;
      }
      // 通用检测：纯数字域名（博彩广告网常用 5-8 位数字域名）
      try {
        const host = new URL(u).hostname.toLowerCase();
        // 匹配纯数字 + 常见广告 TLD（.com/.top/.cc/.app/.xyz/.win）
        if (/^\d{4,8}\.(com|top|cc|app|xyz|win|fun|live|pro)$/.test(host)) {
          // 排除已知合法 CDN（如 cdn.yzzy31-play.com 这类含字母的不受影响）
          return true;
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    // ---- 4) 收集所有 EXTINF+URL 对，用于前贴检测 ----
    const segments: { dur: number; url: string }[] = [];
    for (let si = 0; si < lines.length - 1; si++) {
      if (
        lines[si].trim().startsWith('#EXTINF:') ||
        lines[si].trim().startsWith('#EXT-INF:')
      ) {
        const durMatch = lines[si].match(/#EXT[-X]?INF:([\d.]+)/);
        const durVal = durMatch ? parseFloat(durMatch[1]) : 0;
        const nextUrl = lines[si + 1] ? lines[si + 1].trim() : '';
        if (nextUrl && !nextUrl.startsWith('#')) {
          segments.push({ dur: durVal, url: nextUrl });
        }
      }
    }

    // ---- 5) 前贴广告智能检测（单段长广告 / 首段异常）----
    const preRollThreshold = 45;
    let isLikelyPreRoll =
      segments.length >= 2 &&
      segments.length <= 15 &&
      segments[0].dur >= preRollThreshold &&
      segments[0].dur > (segments[1].dur || 0) * 2;

    if (
      (type === 'iqiyi' || type === 'iqiyi_') &&
      segments.length >= 2 &&
      segments.length <= 20
    ) {
      let avgDur = 0;
      for (let ai = 0; ai < segments.length; ai++) avgDur += segments[ai].dur;
      avgDur /= segments.length;
      if (segments[0].dur >= avgDur * 2.5) isLikelyPreRoll = true;
    }

    // ---- 5.5) 基于首个 #EXT-X-DISCONTINUITY 的前贴检测（多段短分片也能拦）----
    const preRollRemove: Record<number, boolean> = {};
    let discIdx = -1;
    for (let di = 0; di < lines.length; di++) {
      if (lines[di].trim() === '#EXT-X-DISCONTINUITY') {
        discIdx = di;
        break;
      }
    }
    if (discIdx > -1) {
      const preSegs: { ext: number; url: number; u: string }[] = [];
      for (let pi = 0; pi < discIdx; pi++) {
        if (
          lines[pi].trim().startsWith('#EXTINF:') ||
          lines[pi].trim().startsWith('#EXT-INF:')
        ) {
          const pNext = lines[pi + 1] ? lines[pi + 1].trim() : '';
          if (pNext && !pNext.startsWith('#')) {
            preSegs.push({ ext: pi, url: pi + 1, u: pNext });
          }
        }
      }
      if (preSegs.length >= 2) {
        let preDur = 0;
        for (let pd = 0; pd < preSegs.length; pd++) {
          const dm = lines[preSegs[pd].ext].match(/#EXT[-X]?INF:([\d.]+)/);
          preDur += dm ? parseFloat(dm[1]) : 0;
        }
        let looksAd = preDur >= 30;
        if (!looksAd && mainHost) {
          for (let hi = 0; hi < preSegs.length; hi++) {
            try {
              const ph = new URL(preSegs[hi].u).hostname.toLowerCase();
              if (ph && ph !== mainHost) {
                looksAd = true;
                break;
              }
            } catch {
              /* ignore */
            }
          }
        }
        if (!looksAd) {
          for (let ki = 0; ki < preSegs.length; ki++) {
            if (isAdUrl(preSegs[ki].u)) {
              looksAd = true;
              break;
            }
          }
        }
        if (looksAd) {
          for (let ri = 0; ri < preSegs.length; ri++) {
            preRollRemove[preSegs[ri].ext] = true;
            preRollRemove[preSegs[ri].url] = true;
          }
          console.log(
            '[去广告] 前贴广告块命中 (' +
              type +
              '): DISCONTINUITY 前置 ' +
              preSegs.length +
              ' 段, 总时长=' +
              preDur.toFixed(1) +
              's'
          );
        }
      }
    }

    // ---- 6) 输出：先去前贴块，再逐段规则过滤 ----
    const out: string[] = [];
    let removed = 0;
    let preRollSkipped = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const s = line.trim();

      // 前贴预检测：跳过首个 DISCONTINUITY 之前的广告分片
      if (preRollRemove[i]) {
        i++;
        continue;
      }

      // 跳过广告起止标记（SCTE-35 / CUE-OUT/IN），保留普通 DISCONTINUITY
      if (
        s.startsWith('#EXT-X-CUE-OUT') ||
        s.startsWith('#EXT-X-CUE-IN') ||
        s.startsWith('#EXT-X-SCTE') ||
        (s.startsWith('#EXT-X-DATERANGE') && s.includes('SCTE35'))
      ) {
        i++;
        continue;
      }

      // EXTINF 行：检查下一行 URL 是否为广告分片
      if (s.startsWith('#EXTINF:') || s.startsWith('#EXT-INF:')) {
        const next = i + 1 < lines.length ? lines[i + 1].trim() : '';
        let isAd = false;

        if (next && !next.startsWith('#')) {
          // 规则 A：命中已知广告域名/关键字
          if (isAdUrl(next)) {
            isAd = true;
          }
          // 规则 B：来自"非主用 host" => 多半是前贴/中插广告 CDN
          else if (mainHost) {
            try {
              const hh = new URL(next).hostname.toLowerCase();
              if (hh && hh !== mainHost) isAd = true;
            } catch {
              /* ignore */
            }
          }
          // 规则 C：前贴广告跳过（仅对第一段生效）
          else if (isLikelyPreRoll && !preRollSkipped && removed === 0) {
            isAd = true;
            preRollSkipped = true;
            console.log(
              '[去广告] 前贴广告检测命中 (' +
                type +
                '): 首段时长=' +
                segments[0].dur +
                's, 总段=' +
                segments.length
            );
          }
        }
        if (isAd) {
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
        '[去广告] ' +
          type +
          ' 移除 ' +
          removed +
          ' 个广告片段 (mainHost=' +
          mainHost +
          ', preRoll=' +
          preRollSkipped +
          ')'
      );
    }
    return out.join('\n');
  } catch (e) {
    console.error('[内置去广告] 异常，降级返回原内容', e);
    return m3u8Content;
  }
}
