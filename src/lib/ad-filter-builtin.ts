// 内置去广告 —— pass-through 模式
//
// v3 激进规则（非主用 host 当广告、DISCONTINUITY 整块移除、前贴时长检测）
// 导致电影天堂/速播等源的正片被大量误删（只剩片头 01:07）。
// 现改为 pass-through：m3u8 层面不做任何过滤，确保正片完整性。
//
// 广告拦截依赖两层：
//   1) /admin 自定义代码（用户手动配置的过滤函数）
//   2) play/page.tsx 的 DOM 拦截器（MutationObserver + CSS 注入，对付覆盖层广告）

/* eslint-disable no-console */

export function builtInFilterAds(_type: string, m3u8Content: string): string {
  // pass-through：原样返回，不做任何 m3u8 过滤
  return m3u8Content || '';
}
