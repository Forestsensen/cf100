/* eslint-disable @typescript-eslint/no-explicit-any,no-console */
import he from 'he';
import Hls from 'hls.js';

// ============ 设备检测工具函数 ============
const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

export const isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/i.test(userAgent) && !(window as any).MSStream;
export const isIOS13Plus = isIOS || (
  typeof window !== 'undefined' &&
  userAgent.includes('Macintosh') &&
  typeof navigator !== 'undefined' &&
  navigator.maxTouchPoints >= 1
);
export const isIPad = typeof window !== 'undefined' && (/iPad/i.test(userAgent) || (
  userAgent.includes('Macintosh') &&
  typeof navigator !== 'undefined' &&
  navigator.maxTouchPoints > 2
));
export const isAndroid = /Android/i.test(userAgent);
export const isMobile = isIOS13Plus || isAndroid || /webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
export const isTablet = isIPad || (isAndroid && !/Mobile/i.test(userAgent)) ||
  (typeof window !== 'undefined' && typeof screen !== 'undefined' && screen.width >= 768);
export const isSafari = /^(?:(?!chrome|android).)*safari/i.test(userAgent) && !isAndroid;

export type DevicePerformance = 'low' | 'medium' | 'high';
export function getDevicePerformanceLevel(): DevicePerformance {
  if (typeof navigator === 'undefined') return 'medium';
  const cores = navigator.hardwareConcurrency || 4;
  if (isMobile) return cores >= 6 ? 'medium' : 'low';
  return cores >= 8 ? 'high' : cores >= 4 ? 'medium' : 'low';
}
export const devicePerformance: DevicePerformance = typeof window !== 'undefined' ? getDevicePerformanceLevel() : 'medium';

function getDoubanImageProxyConfig(): {
  proxyType:
  | 'server'
  | 'cmliussss-cdn-tencent'
  | 'cmliussss-cdn-ali'
  | 'custom';
  proxyUrl: string;
} {
  let doubanImageProxyType =
    localStorage.getItem('doubanImageProxyType') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY_TYPE ||
    'cmliussss-cdn-tencent';
  // 兼容历史数据：直连和豆瓣官方精品 CDN 统一使用服务器代理
  if (doubanImageProxyType === 'direct' || doubanImageProxyType === 'img3') {
    doubanImageProxyType = 'server';
  }
  const doubanImageProxy =
    localStorage.getItem('doubanImageProxyUrl') ||
    (window as any).RUNTIME_CONFIG?.DOUBAN_IMAGE_PROXY ||
    '';
  return {
    proxyType: doubanImageProxyType,
    proxyUrl: doubanImageProxy,
  };
}

/**
 * 处理图片 URL，如果设置了图片代理则使用代理
 */
export function processImageUrl(originalUrl: string): string {
  if (!originalUrl) return originalUrl;

  // 仅处理豆瓣图片代理
  if (!originalUrl.includes('doubanio.com')) {
    return originalUrl;
  }

  const { proxyType, proxyUrl } = getDoubanImageProxyConfig();
  switch (proxyType) {
    case 'server':
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
    case 'cmliussss-cdn-tencent':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.net'
      );
    case 'cmliussss-cdn-ali':
      return originalUrl.replace(
        /img\d+\.doubanio\.com/g,
        'img.doubanio.cmliussss.com'
      );
    case 'custom':
      return `${proxyUrl}${encodeURIComponent(originalUrl)}`;
    default:
      return `/api/image-proxy?url=${encodeURIComponent(originalUrl)}`;
  }
}

/**
 * 从m3u8地址获取视频质量等级和网络信息
 * 优化：通过 CORSAPI 代理解决跨域，下载 3 个分片取平均速度
 * @param m3u8Url m3u8播放列表的URL
 * @returns Promise<{quality: string, loadSpeed: string, pingTime: number}> 视频质量等级和网络信息
 */
export async function getVideoResolutionFromM3u8(m3u8Url: string): Promise<{
  quality: string; // 如720p、1080p等
  loadSpeed: string; // 自动转换为KB/s或MB/s
  pingTime: number; // 网络延迟（毫秒）
}> {
  // CORSAPI 代理地址
  const CORSAPI_PROXY = 'https://tvdy.102624.xyz';
  const proxyUrl = `${CORSAPI_PROXY}/?url=${encodeURIComponent(m3u8Url)}`;

  try {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.muted = true;
      video.preload = 'metadata';

      // 测量网络延迟（ping时间）- 通过代理
      const pingStart = performance.now();
      let pingTime = 0;

      fetch(proxyUrl, { method: 'HEAD' })
        .then(() => {
          pingTime = performance.now() - pingStart;
        })
        .catch(() => {
          pingTime = performance.now() - pingStart;
        });

      // 使用 hls.js 加载（通过代理）
      const hls = new Hls();

      // 设置超时处理（延长到 6 秒，因为需要测 3 个分片）
      const timeout = setTimeout(() => {
        hls.destroy();
        video.remove();
        reject(new Error('Timeout loading video metadata'));
      }, 6000);

      video.onerror = () => {
        clearTimeout(timeout);
        hls.destroy();
        video.remove();
        reject(new Error('Failed to load video metadata'));
      };

      let actualLoadSpeed = '未知';
      let hasSpeedCalculated = false;
      let hasMetadataLoaded = false;

      // 下载 3 个分片取平均速度（更准确）
      const MAX_SEGMENTS = 3;
      const segmentSpeeds: number[] = [];
      let fragmentStartTime = 0;

      // 检查是否可以返回结果
      const checkAndResolve = () => {
        if (
          hasMetadataLoaded &&
          (hasSpeedCalculated || actualLoadSpeed !== '未知')
        ) {
          clearTimeout(timeout);
          const width = video.videoWidth;
          if (width && width > 0) {
            hls.destroy();
            video.remove();

            // 根据视频宽度判断视频质量等级
            const quality =
              width >= 3840 ? '4K'
                : width >= 2560 ? '2K'
                  : width >= 1920 ? '1080p'
                    : width >= 1280 ? '720p'
                      : width >= 854 ? '480p'
                        : 'SD';

            resolve({
              quality,
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          } else {
            resolve({
              quality: '未知',
              loadSpeed: actualLoadSpeed,
              pingTime: Math.round(pingTime),
            });
          }
        }
      };

      // 监听片段加载开始
      hls.on(Hls.Events.FRAG_LOADING, () => {
        fragmentStartTime = performance.now();
      });

      // 监听片段加载完成，下载 3 个分片取平均速度
      hls.on(Hls.Events.FRAG_LOADED, (event: any, data: any) => {
        if (fragmentStartTime > 0 && data && data.payload) {
          const loadTime = performance.now() - fragmentStartTime;
          const size = data.payload.byteLength || 0;

          if (loadTime > 0 && size > 0) {
            const speedKBps = size / 1024 / (loadTime / 1000);
            segmentSpeeds.push(speedKBps);

            // 收集够 3 个分片或已标记完成
            if (segmentSpeeds.length >= MAX_SEGMENTS && !hasSpeedCalculated) {
              // 计算平均速度（去掉最高最低取平均，更稳定）
              segmentSpeeds.sort((a, b) => a - b);
              const avgSpeedKBps = segmentSpeeds.length > 2
                ? segmentSpeeds.slice(1, -1).reduce((a, b) => a + b, 0) / (segmentSpeeds.length - 2)
                : segmentSpeeds.reduce((a, b) => a + b, 0) / segmentSpeeds.length;

              if (avgSpeedKBps >= 1024) {
                actualLoadSpeed = `${(avgSpeedKBps / 1024).toFixed(1)} MB/s`;
              } else {
                actualLoadSpeed = `${avgSpeedKBps.toFixed(1)} KB/s`;
              }
              hasSpeedCalculated = true;
              checkAndResolve();
            }
          }
        }
      });

      // 通过 CORSAPI 代理加载（解决跨域问题）
      hls.loadSource(proxyUrl);
      hls.attachMedia(video);

      // 监听hls.js错误
      hls.on(Hls.Events.ERROR, (event: any, data: any) => {
        console.error('HLS错误:', data);
        if (data.fatal) {
          clearTimeout(timeout);
          hls.destroy();
          video.remove();
          reject(new Error(`HLS播放失败: ${data.type}`));
        }
      });

      // 监听视频元数据加载完成
      video.onloadedmetadata = () => {
        hasMetadataLoaded = true;
        checkAndResolve(); // 尝试返回结果
      };
    });
  } catch (error) {
    throw new Error(
      `Error getting video resolution: ${error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

export function cleanHtmlTags(text: string): string {
  if (!text) return '';

  const cleanedText = text
    .replace(/<[^>]+>/g, '\n') // 将 HTML 标签替换为换行
    .replace(/\n+/g, '\n') // 将多个连续换行合并为一个
    .replace(/[ \t]+/g, ' ') // 将多个连续空格和制表符合并为一个空格，但保留换行符
    .replace(/^\n+|\n+$/g, '') // 去掉首尾换行
    .trim(); // 去掉首尾空格

  // 使用 he 库解码 HTML 实体
  return he.decode(cleanedText);
}
