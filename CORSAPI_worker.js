// CORSAPI Worker - 完整版
// 功能：代理请求、配置订阅、KV 日志、源站分析、源站可用性检查（Cron Trigger）
// 部署到 Cloudflare Workers

// 统一入口：兼容 Cloudflare Workers 和 Pages Functions
export default {
  async fetch(request, env, ctx) {
    // Pages Functions 中 KV 需要从 env 中获取
    // 绑定名：CONFIG_KV
    if (env && env.CONFIG_KV && typeof globalThis.KV === 'undefined') {
      globalThis.KV = env.CONFIG_KV
    }

    // 传递 ctx 用于 ctx.waitUntil 异步写日志
    return handleRequest(request, ctx)
  },

  // Cron Trigger：定时检查源站可用性
  async scheduled(event, env, ctx) {
    if (env && env.CONFIG_KV && typeof globalThis.KV === 'undefined') {
      globalThis.KV = env.CONFIG_KV
    }
    ctx.waitUntil(checkAllSources())
  }
}

// 常量配置
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

const EXCLUDE_HEADERS = new Set([
  'content-encoding', 'content-length', 'transfer-encoding',
  'connection', 'keep-alive', 'set-cookie', 'set-cookie2'
])

// 代理请求时只转发这些头（避免泄露 Host/Cookie/Referer）
const PROXY_FORWARD_HEADERS = new Set([
  'accept', 'accept-language', 'accept-encoding',
  'range', 'user-agent', 'if-modified-since', 'if-none-match',
  'content-type', 'authorization'
])

const JSON_SOURCES = {
  'jin18': 'https://raw.githubusercontent.com/Forestsensen/LunaTV-config/refs/heads/main/jin18.json',
  'jingjian': 'https://raw.githubusercontent.com/Forestsensen/LunaTV-config/refs/heads/main/jingjian.json',
  'full': 'https://raw.githubusercontent.com/hafrey1/LunaTV-config/refs/heads/main/LunaTV-config.json'
}

const FORMAT_CONFIG = {
  '0': { proxy: false, base58: false },
  'raw': { proxy: false, base58: false },
  '1': { proxy: true, base58: false },
  'proxy': { proxy: true, base58: false },
  '2': { proxy: false, base58: true },
  'base58': { proxy: false, base58: true },
  '3': { proxy: true, base58: true },
  'proxy-base58': { proxy: true, base58: true }
}

// Base58 编码函数
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
function base58Encode(obj) {
  const str = JSON.stringify(obj)
  const bytes = new TextEncoder().encode(str)

  let intVal = 0n
  for (let b of bytes) {
    intVal = (intVal << 8n) + BigInt(b)
  }

  let result = ''
  while (intVal > 0n) {
    const mod = intVal % 58n
    result = BASE58_ALPHABET[Number(mod)] + result
    intVal = intVal / 58n
  }

  for (let b of bytes) {
    if (b === 0) result = BASE58_ALPHABET[0] + result
    else break
  }

  return result
}

// JSON api 字段前缀替换
function addOrReplacePrefix(obj, newPrefix) {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(item => addOrReplacePrefix(item, newPrefix))
  const newObj = {}
  for (const key in obj) {
    if (key === 'api' && typeof obj[key] === 'string') {
      let apiUrl = obj[key]
      const urlIndex = apiUrl.indexOf('?url=')
      if (urlIndex !== -1) apiUrl = apiUrl.slice(urlIndex + 5)
      if (!apiUrl.startsWith(newPrefix)) apiUrl = newPrefix + apiUrl
      newObj[key] = apiUrl
    } else {
      newObj[key] = addOrReplacePrefix(obj[key], newPrefix)
    }
  }
  return newObj
}

// ---------- KV 缓存（30分钟TTL）----------
async function getCachedJSON(url) {
  const kvAvailable = typeof KV !== 'undefined' && KV && typeof KV.get === 'function'

  if (kvAvailable) {
    const cacheKey = 'CACHE_' + url
    const cached = await KV.get(cacheKey)
    if (cached) {
      try {
        return JSON.parse(cached)
      } catch (e) {
        await KV.delete(cacheKey)
      }
    }
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    const data = await res.json()
    await KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 1800 })  // 缓存30分钟
    return data
  } else {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
    return await res.json()
  }
}

// ---------- 日志（仅控制台，不写KV节省配额）----------
function logRequest(entry) {
  console.log('[REQUEST]', JSON.stringify(entry))
}

function logError(type, info) {
  console.error('[ERROR]', type, JSON.stringify(info))
}

function ctx_waitUntil_logRequest(ctx, entry) {
  // 直接同步打印，不写KV
  logRequest(entry)
}

// ---------- 源站可用性检查（Cron Trigger）----------
const CHECK_SOURCES_KV_KEY = 'SOURCE_CHECK_REPORT'
const CHECK_HISTORY_KV_KEY = 'SOURCE_CHECK_HISTORY'

// 视频源列表（从 LunaTV-config.json 的 api_site 提取）
// 格式: { name, api, detail? }
const VIDEO_SOURCES = [
  { name: '360资源', api: 'https://360zyzz.com/api.php/provide/vod' },
  { name: '非凡资源', api: 'https://api.ffzyapi.com/api.php/provide/vod' },
  { name: '猫眼资源', api: 'https://api.maoyanapi.top/api.php/provide/vod' },
  { name: 'U酷资源', api: 'https://api.ukuapi88.com/api.php/provide/vod' },
  { name: '无尽资源', api: 'https://api.wujinapi.me/api.php/provide/vod' },
  { name: '优质资源', api: 'https://api.wwzy.tv/api.php/provide/vod' },
  { name: '暴风资源', api: 'https://bfikunccdn.com/api.php/provide/vod' },
  { name: '量子资源', api: 'https://cj.lziapi.com/api.php/provide/vod' },
  { name: '闪电资源', api: 'https://sdzyapi.com/api.php/provide/vod' },
  { name: '光速资源', api: 'https://api.guangsuapi.com/api.php/provide/vod' },
  { name: '红牛资源', api: 'https://www.hongniuzy2.com/api.php/provide/vod' },
  { name: '无极资源', api: 'https://api.wujinkk.com/api.php/provide/vod' },
  { name: '卧龙资源', api: 'https://collect.wolongzyw.com/api.php/provide/vod' },
  { name: '先锋资源', api: 'https://api.xfapi.com/api.php/provide/vod' },
  { name: '超快资源', api: 'https://ckzy.me/api.php/provide/vod' },
  { name: '光棍资源', api: 'https://api.ckapi.com/api.php/provide/vod' },
]

// 检查单个源站
async function checkSingleSource(source, timeout = 8000) {
  const result = {
    name: source.name,
    api: source.api,
    status: 'unknown',
    statusCode: 0,
    responseTime: 0,
    searchOk: false,
    error: null,
    timestamp: new Date().toISOString()
  }

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    // 1. 基础可达性检查
    const start = Date.now()
    const res = await fetch(source.api, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LunaTV-Checker/1.0)' }
    })
    result.responseTime = Date.now() - start
    result.statusCode = res.status

    if (res.status !== 200) {
      result.status = 'error'
      result.error = `HTTP ${res.status}`
      clearTimeout(timer)
      return result
    }

    // 2. 搜索功能检查
    try {
      const searchUrl = `${source.api}?wd=斗罗大陆`
      const searchRes = await fetch(searchUrl, {
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LunaTV-Checker/1.0)' }
      })

      if (searchRes.ok) {
        const data = await searchRes.json()
        if (data.list && Array.isArray(data.list) && data.list.length > 0) {
          result.searchOk = true
        }
      }
    } catch {
      // 搜索检查失败不影响整体状态
    }

    clearTimeout(timer)
    result.status = 'ok'
  } catch (e) {
    result.status = 'error'
    result.error = e.name === 'AbortError' ? '超时' : e.message
  }

  return result
}

// 检查所有源站（Cron Trigger 调用）
async function checkAllSources() {
  const kvAvailable = typeof KV !== 'undefined' && KV && typeof KV.get === 'function'
  if (!kvAvailable) {
    console.error('[CHECK] KV not available')
    return
  }

  console.log(`[CHECK] 开始检查 ${VIDEO_SOURCES.length} 个源站...`)

  // 并发检查（限制并发数为 5）
  const CONCURRENT = 5
  const results = []
  for (let i = 0; i < VIDEO_SOURCES.length; i += CONCURRENT) {
    const batch = VIDEO_SOURCES.slice(i, i + CONCURRENT)
    const batchResults = await Promise.all(batch.map(s => checkSingleSource(s)))
    results.push(...batchResults)
  }

  // 统计
  const okCount = results.filter(r => r.status === 'ok').length
  const errorCount = results.filter(r => r.status === 'error').length
  const avgResponseTime = results
    .filter(r => r.responseTime > 0)
    .reduce((sum, r) => sum + r.responseTime, 0) / (okCount || 1)

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: results.length,
      ok: okCount,
      error: errorCount,
      avgResponseTime: Math.round(avgResponseTime)
    },
    sources: results
  }

  // 写入当前报告
  await KV.put(CHECK_SOURCES_KV_KEY, JSON.stringify(report), { expirationTtl: 86400 * 7 })

  // 追加到历史记录（保留最近30天）
  let history = []
  try {
    const cached = await KV.get(CHECK_HISTORY_KV_KEY)
    if (cached) history = JSON.parse(cached)
  } catch {}

  // 只保留每天的摘要
  const today = new Date().toISOString().split('T')[0]
  const daySummary = {
    date: today,
    ok: okCount,
    error: errorCount,
    avgResponseTime: Math.round(avgResponseTime),
    sources: results.map(r => ({
      name: r.name,
      status: r.status,
      responseTime: r.responseTime,
      searchOk: r.searchOk
    }))
  }

  // 替换今天的数据（如果已存在）
  history = history.filter(h => h.date !== today)
  history.push(daySummary)

  // 只保留最近30天
  if (history.length > 30) {
    history = history.slice(-30)
  }

  await KV.put(CHECK_HISTORY_KV_KEY, JSON.stringify(history), { expirationTtl: 86400 * 35 })

  console.log(`[CHECK] 完成: ${okCount} 正常, ${errorCount} 异常, 平均 ${Math.round(avgResponseTime)}ms`)
}

// ---------- 主逻辑 ----------
async function handleRequest(request, ctx) {
  // 快速处理 OPTIONS 请求
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  const reqUrl = new URL(request.url)
  const pathname = reqUrl.pathname
  const targetUrlParam = reqUrl.searchParams.get('url')
  const formatParam = reqUrl.searchParams.get('format')
  const prefixParam = reqUrl.searchParams.get('prefix')
  const sourceParam = reqUrl.searchParams.get('source')

  const currentOrigin = reqUrl.origin
  const defaultPrefix = currentOrigin + '/?url='

  // 🩺 健康检查
  if (pathname === '/health') {
    return new Response('OK', { status: 200, headers: CORS_HEADERS })
  }

  // 📋 源站可用性报告
  if (pathname === '/report') {
    return handleReport()
  }

  // 通用代理请求处理
  if (targetUrlParam) {
    return handleProxyRequest(request, targetUrlParam, currentOrigin, ctx)
  }

  // JSON 格式输出处理
  if (formatParam !== null) {
    return handleFormatRequest(formatParam, sourceParam, prefixParam, defaultPrefix, ctx)
  }

  // 返回首页文档
  return handleHomePage(currentOrigin, defaultPrefix)
}

// ---------- 源站可用性报告 ----------
async function handleReport() {
  const kvAvailable = typeof KV !== 'undefined' && KV && typeof KV.get === 'function'
  if (!kvAvailable) {
    return new Response('KV not available', { status: 500, headers: CORS_HEADERS })
  }

  try {
    const [reportRaw, historyRaw] = await Promise.all([
      KV.get(CHECK_SOURCES_KV_KEY),
      KV.get(CHECK_HISTORY_KV_KEY)
    ])

    const report = reportRaw ? JSON.parse(reportRaw) : null
    const history = historyRaw ? JSON.parse(historyRaw) : []

    if (!report) {
      return new Response(JSON.stringify({
        message: '暂无检查数据，Cron Trigger 会自动执行检查',
        hint: '请在 Cloudflare Workers 设置中配置 Cron Trigger: 每天 08:00 和 20:00'
      }, null, 2), {
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      })
    }

    // 生成最近7天趋势
    const last7days = history.slice(-7)

    // 生成 HTML 报告
    const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>视频源站可用性报告</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 1000px; margin: 40px auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .summary { background: #fff; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; gap: 30px; flex-wrap: wrap; }
    .stat { text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; }
    .stat-label { color: #666; font-size: 14px; }
    .ok { color: #4CAF50; }
    .error { color: #f44336; }
    table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    th { background: #4CAF50; color: #fff; padding: 12px; text-align: left; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; }
    tr:hover { background: #f9f9f9; }
    .trend { font-size: 16px; letter-spacing: 2px; }
    .timestamp { color: #999; font-size: 14px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }
    .badge-ok { background: #e8f5e9; color: #2e7d32; }
    .badge-error { background: #ffebee; color: #c62828; }
    .search-ok { color: #4CAF50; }
    .search-fail { color: #ff9800; }
  </style>
</head>
<body>
  <h1>📋 视频源站可用性报告</h1>
  <p class="timestamp">检查时间: ${new Date(report.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>

  <div class="summary">
    <div class="stat">
      <div class="stat-value">${report.summary.total}</div>
      <div class="stat-label">总源数</div>
    </div>
    <div class="stat">
      <div class="stat-value ok">${report.summary.ok}</div>
      <div class="stat-label">正常</div>
    </div>
    <div class="stat">
      <div class="stat-value error">${report.summary.error}</div>
      <div class="stat-label">异常</div>
    </div>
    <div class="stat">
      <div class="stat-value">${report.summary.avgResponseTime}ms</div>
      <div class="stat-label">平均响应</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>状态</th>
        <th>源站名称</th>
        <th>API</th>
        <th>响应时间</th>
        <th>搜索功能</th>
        <th>7天趋势</th>
      </tr>
    </thead>
    <tbody>
      ${report.sources.map(s => {
        const statusIcon = s.status === 'ok' ? '✅' : '❌'
        const statusClass = s.status === 'ok' ? 'badge-ok' : 'badge-error'
        const searchIcon = s.searchOk ? '<span class="search-ok">✅</span>' : '<span class="search-fail">❌</span>'

        // 从历史数据中提取7天趋势
        const trend = last7days.map(day => {
          const daySource = day.sources?.find(ds => ds.name === s.name)
          return daySource?.status === 'ok' ? '✅' : '❌'
        }).join('')

        return `<tr>
          <td><span class="badge ${statusClass}">${statusIcon}</span></td>
          <td><strong>${s.name}</strong></td>
          <td style="font-size:12px; word-break:break-all;">${s.api}</td>
          <td>${s.status === 'ok' ? s.responseTime + 'ms' : s.error || '-'}</td>
          <td>${s.status === 'ok' ? searchIcon : '-'}</td>
          <td class="trend">${trend || '-'}</td>
        </tr>`
      }).join('')}
    </tbody>
  </table>

  <p style="color:#666; font-size:14px;">
    检查频率: 每天 08:00 和 20:00 (Cron Trigger) | 
    趋势: ${last7days.length} 天数据
  </p>
</body>
</html>`

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    })
  }
}

// ---------- 代理请求处理 ----------
async function handleProxyRequest(request, targetUrlParam, currentOrigin, ctx) {
  // 🚨 防止递归调用
  if (targetUrlParam.startsWith(currentOrigin)) {
    return errorResponse('Loop detected: self-fetch blocked', { url: targetUrlParam }, 400)
  }

  // 🚨 防止无效 URL
  if (!/^https?:\/\//i.test(targetUrlParam)) {
    return errorResponse('Invalid target URL', { url: targetUrlParam }, 400)
  }

  let fullTargetUrl = targetUrlParam
  const urlMatch = request.url.match(/[?&]url=([^&]+(?:&.*)?)/)
  if (urlMatch) fullTargetUrl = decodeURIComponent(urlMatch[1])

  let targetURL
  try {
    targetURL = new URL(fullTargetUrl)
  } catch {
    await logError('proxy', { message: 'Invalid URL', url: fullTargetUrl })
    return errorResponse('Invalid URL', { url: fullTargetUrl }, 400)
  }

  const startTime = Date.now()

  try {
    // 只转发安全的请求头（避免 Host/Cookie/Referer 泄露）
    const proxyHeaders = new Headers()
    for (const key of PROXY_FORWARD_HEADERS) {
      if (request.headers.has(key)) {
        proxyHeaders.set(key, request.headers.get(key))
      }
    }

    const proxyRequest = new Request(targetURL.toString(), {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer()
        : undefined,
    })

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 9000)
    const response = await fetch(proxyRequest, { signal: controller.signal })
    clearTimeout(timeoutId)

    const elapsed = Date.now() - startTime

    // 记录请求日志
    ctx_waitUntil_logRequest(ctx, {
      type: 'proxy',
      target: fullTargetUrl,
      host: targetURL.hostname,
      method: request.method,
      status: response.status,
      elapsed,
      timestamp: new Date().toISOString()
    })

    const responseHeaders = new Headers(CORS_HEADERS)
    for (const [key, value] of response.headers) {
      if (!EXCLUDE_HEADERS.has(key.toLowerCase())) {
        responseHeaders.set(key, value)
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders
    })
  } catch (err) {
    const elapsed = Date.now() - startTime

    await logError('proxy', {
      message: err.message || '代理请求失败',
      url: fullTargetUrl,
      elapsed
    })

    return errorResponse('Proxy Error', {
      message: err.message || '代理请求失败',
      target: fullTargetUrl,
      timestamp: new Date().toISOString()
    }, 502)
  }
}

// ---------- JSON 格式输出处理 ----------
async function handleFormatRequest(formatParam, sourceParam, prefixParam, defaultPrefix, ctx) {
  const startTime = Date.now()

  try {
    const config = FORMAT_CONFIG[formatParam]
    if (!config) {
      return errorResponse('Invalid format parameter', { format: formatParam }, 400)
    }

    const selectedSource = JSON_SOURCES[sourceParam] || JSON_SOURCES['full']
    const data = await getCachedJSON(selectedSource)

    const newData = config.proxy
      ? addOrReplacePrefix(data, prefixParam || defaultPrefix)
      : data

    const elapsed = Date.now() - startTime

    // 记录配置订阅日志
    ctx_waitUntil_logRequest(ctx, {
      type: 'config',
      source: sourceParam || 'full',
      format: formatParam,
      proxy: config.proxy,
      base58: config.base58,
      elapsed,
      timestamp: new Date().toISOString()
    })

    if (config.base58) {
      const encoded = base58Encode(newData)
      return new Response(encoded, {
        headers: { 'Content-Type': 'text/plain;charset=UTF-8', ...CORS_HEADERS },
      })
    } else {
      return new Response(JSON.stringify(newData), {
        headers: { 'Content-Type': 'application/json;charset=UTF-8', ...CORS_HEADERS },
      })
    }
  } catch (err) {
    await logError('json', { message: err.message })
    return errorResponse(err.message, {}, 500)
  }
}

// ---------- 首页文档 ----------
async function handleHomePage(currentOrigin, defaultPrefix) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API 中转代理服务</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; }
    h2 { color: #555; margin-top: 30px; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 14px; }
    pre { background: #f4f4f4; padding: 15px; border-radius: 5px; overflow-x: auto; }
    .example { background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0; }
    .section { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 15px 0; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table td { padding: 8px; border: 1px solid #ddd; }
    table td:first-child { background: #f5f5f5; font-weight: bold; width: 30%; }
  </style>
</head>
<body>
  <h1>🔄 API 中转代理服务</h1>
  <p>通用 API 中转代理，用于访问被墙或限制的接口。</p>

  <h2>使用方法</h2>
  <p>中转任意 API：在请求 URL 后添加 <code>?url=目标地址</code> 参数</p>
  <pre>${defaultPrefix}<示例API地址></pre>

  <h2>配置订阅参数说明</h2>
  <div class="section">
    <table>
      <tr>
        <td>format</td>
        <td><code>0</code> 或 <code>raw</code> = 原始 JSON<br>
            <code>1</code> 或 <code>proxy</code> = 添加代理前缀<br>
            <code>2</code> 或 <code>base58</code> = 原始 Base58 编码<br>
            <code>3</code> 或 <code>proxy-base58</code> = 代理 Base58 编码</td>
      </tr>
      <tr>
        <td>source</td>
        <td><code>jin18</code> = 精简版<br>
            <code>jingjian</code> = 精简版+成人<br>
            <code>full</code> = 完整版（默认）</td>
      </tr>
      <tr>
        <td>prefix</td>
        <td>自定义代理前缀（仅在 format=1 或 3 时生效）</td>
      </tr>
    </table>
  </div>

  <h2>配置订阅链接示例</h2>

  <div class="section">
    <h3>📦 精简版（jin18）</h3>
    <p>原始 JSON：<br><code class="copyable">${currentOrigin}?format=0&source=jin18</code> <button class="copy-btn">复制</button></p>
    <p>中转代理 JSON：<br><code class="copyable">${currentOrigin}?format=1&source=jin18</code> <button class="copy-btn">复制</button></p>
    <p>原始 Base58：<br><code class="copyable">${currentOrigin}?format=2&source=jin18</code> <button class="copy-btn">复制</button></p>
    <p>中转 Base58：<br><code class="copyable">${currentOrigin}?format=3&source=jin18</code> <button class="copy-btn">复制</button></p>
  </div>

  <div class="section">
    <h3>📦 精简版+成人（jingjian）</h3>
    <p>原始 JSON：<br><code class="copyable">${currentOrigin}?format=0&source=jingjian</code> <button class="copy-btn">复制</button></p>
    <p>中转代理 JSON：<br><code class="copyable">${currentOrigin}?format=1&source=jingjian</code> <button class="copy-btn">复制</button></p>
    <p>原始 Base58：<br><code class="copyable">${currentOrigin}?format=2&source=jingjian</code> <button class="copy-btn">复制</button></p>
    <p>中转 Base58：<br><code class="copyable">${currentOrigin}?format=3&source=jingjian</code> <button class="copy-btn">复制</button></p>
  </div>

  <div class="section">
    <h3>📦 完整版（full，默认）</h3>
    <p>原始 JSON：<br><code class="copyable">${currentOrigin}?format=0&source=full</code> <button class="copy-btn">复制</button></p>
    <p>中转代理 JSON：<br><code class="copyable">${currentOrigin}?format=1&source=full</code> <button class="copy-btn">复制</button></p>
    <p>原始 Base58：<br><code class="copyable">${currentOrigin}?format=2&source=full</code> <button class="copy-btn">复制</button></p>
    <p>中转 Base58：<br><code class="copyable">${currentOrigin}?format=3&source=full</code> <button class="copy-btn">复制</button></p>
  </div>

  <h2>支持的功能</h2>
  <ul>
    <li>✅ 支持 GET、POST、PUT、DELETE 等所有 HTTP 方法</li>
    <li>✅ 安全头转发（不泄露 Host/Cookie/Referer）</li>
    <li>✅ 保留原始响应头（除敏感信息）</li>
    <li>✅ 完整的 CORS 支持</li>
    <li>✅ 超时保护（9 秒）</li>
    <li>✅ 支持多种配置源切换</li>
    <li>✅ 支持 Base58 编码输出</li>
    <li>✅ 源站可用性报告（<a href="/report">/report</a>）</li>
  </ul>

  <script>
    document.querySelectorAll('.copy-btn').forEach((btn, idx) => {
      btn.addEventListener('click', () => {
        const text = document.querySelectorAll('.copyable')[idx].innerText;
        navigator.clipboard.writeText(text).then(() => {
          btn.innerText = '已复制！';
          setTimeout(() => (btn.innerText = '复制'), 1500);
        });
      });
    });
  </script>
</body>
</html>`

  return new Response(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', ...CORS_HEADERS }
  })
}

// ---------- 统一错误响应 ----------
function errorResponse(error, data = {}, status = 400) {
  return new Response(JSON.stringify({ error, ...data }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
  })
}