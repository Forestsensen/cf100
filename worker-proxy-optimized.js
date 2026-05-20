// API 中转代理服务 — Cloudflare Workers 精简版
// 移除 Pages Functions 兼容层、KV 缓存、HTML 首页、base58 编码

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const SKIP_HEADERS = new Set([
  'content-encoding', 'content-length', 'transfer-encoding',
  'connection', 'keep-alive',
])

const SOURCES = {
  jin18: 'https://raw.githubusercontent.com/Forestsensen/LunaTV-config/refs/heads/main/jin18.json',
  jingjian: 'https://raw.githubusercontent.com/Forestsensen/LunaTV-config/refs/heads/main/jingjian.json',
  full: 'https://raw.githubusercontent.com/hafrey1/LunaTV-config/refs/heads/main/LunaTV-config.json',
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS })
    }

    const url = new URL(request.url)
    const target = url.searchParams.get('url')
    const format = url.searchParams.get('format')
    const source = url.searchParams.get('source')
    const prefix = url.searchParams.get('prefix')

    // 代理请求
    if (target) {
      if (target.startsWith(url.origin)) {
        return json('循环请求已阻止', 400)
      }
      if (!/^https?:\/\//i.test(target)) {
        return json('无效的 URL', 400)
      }
      return proxy(request, target)
    }

    // JSON 配置输出
    if (format !== null) {
      const needProxy = format === '1' || format === 'proxy'
      if (!needProxy && format !== '0' && format !== 'raw') {
        return json('无效的 format 参数', 400)
      }
      return serveConfig(url.origin, source, prefix, needProxy)
    }

    return json('API 中转代理服务运行中', 200)
  },
}

async function proxy(request, target) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 15000)

    const resp = await fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method !== 'GET' && request.method !== 'HEAD'
        ? await request.arrayBuffer() : undefined,
      signal: controller.signal,
    })
    clearTimeout(timer)

    const headers = new Headers(CORS)
    resp.headers.forEach((v, k) => {
      if (!SKIP_HEADERS.has(k)) headers.set(k, v)
    })

    return new Response(resp.body, {
      status: resp.status,
      statusText: resp.statusText,
      headers,
    })
  } catch (err) {
    return json(err.name === 'AbortError' ? '代理超时' : '代理请求失败', 502)
  }
}

async function serveConfig(origin, source, prefix, needProxy) {
  const sourceUrl = SOURCES[source] || SOURCES.full
  try {
    const resp = await fetch(sourceUrl)
    if (!resp.ok) return json('获取配置失败: ' + resp.status, 502)

    let data = await resp.json()
    if (needProxy) {
      const p = prefix || (origin + '/?url=')
      data = rewriteApiPrefix(data, p)
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
    })
  } catch (err) {
    return json('配置加载失败', 500)
  }
}

function rewriteApiPrefix(obj, prefix) {
  if (typeof obj !== 'object' || obj === null) return obj
  if (Array.isArray(obj)) return obj.map(v => rewriteApiPrefix(v, prefix))
  const out = {}
  for (const k in obj) {
    if (k === 'api' && typeof obj[k] === 'string') {
      let u = obj[k]
      const i = u.indexOf('?url=')
      if (i !== -1) u = u.slice(i + 5)
      out[k] = u.startsWith(prefix) ? u : prefix + u
    } else {
      out[k] = rewriteApiPrefix(obj[k], prefix)
    }
  }
  return out
}

function json(msg, status) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS },
  })
}
