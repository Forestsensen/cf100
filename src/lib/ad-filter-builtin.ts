// 内置去广告 —— 保守关键字策略（对齐 ergTV-main 默认规则）
//
// 仅删除「URL 含广告关键字」的片段，跳过 #EXT-X-DISCONTINUITY 标识（不删相邻内容）。
// 不做 host-divergence / 前贴时长 / 死链 CDN 等启发式判定，避免误删正片。
// 更强的规则请走 /admin 自定义代码（filterAdsFromM3U8）。

export function builtInFilterAds(_type: string, m3u8Content: string): string {
  if (!m3u8Content) return '';

  // 广告关键字列表（对齐 ergTV-main 默认规则）
  const adKeywords = [
    'sponsor',
    '/ad/',
    '/ads/',
    'advert',
    'advertisement',
    '/adjump',
    'redtraffic',
  ];

  const lines = m3u8Content.split('\n');
  const filteredLines: string[] = [];

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // 跳过 #EXT-X-DISCONTINUITY 标识（不删除相邻分片，避免 A/V 不同步）
    if (line.includes('#EXT-X-DISCONTINUITY')) {
      i++;
      continue;
    }

    // 如果是 EXTINF 行，检查下一行 URL 是否包含广告关键字
    if (line.includes('#EXTINF:')) {
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const containsAdKeyword = adKeywords.some((keyword) =>
          nextLine.toLowerCase().includes(keyword.toLowerCase())
        );

        if (containsAdKeyword) {
          // 跳过 EXTINF 行和 URL 行
          i += 2;
          continue;
        }
      }
    }

    // 保留当前行
    filteredLines.push(line);
    i++;
  }

  return filteredLines.join('\n');
}
