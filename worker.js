/**
 * pixiv-proxy — Cloudflare Workers 版
 *
 * 与 Node 版 (app.mjs) 逻辑一致：
 *   /pixiv-app-api/* → app-api.pixiv.net   （App API 透传）
 *   /pixiv-oauth/*   → oauth.secure.pixiv.net（OAuth 登录/刷新）
 *   其余路径          → i.pximg.net          （图片 CDN 反代，自动带防盗链 Referer）
 *
 * 纯透传，服务端不存储任何账号令牌。
 */

const APP_API_ORIGIN = 'https://app-api.pixiv.net'
const OAUTH_ORIGIN = 'https://oauth.secure.pixiv.net'
const PXIMG_ORIGIN = 'https://i.pximg.net'

const CLIENT_UA =
  'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'

const PIXIV_API_HEADERS = {
  'App-OS': 'Android',
  'App-OS-Version': 'Android 15.0',
  'App-Version': '6.168.0',
  'Accept-Language': 'zh-CN',
  'User-Agent': 'PixivAndroidApp/6.168.0 (Android 15.0; Pixel 9)',
}

const FORWARDED_HEADERS = ['authorization', 'content-type', 'x-client-time', 'x-client-hash']

const INFO_PAGE = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>pixiv-proxy</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#26215c;line-height:1.7}
code{background:#EEEDFE;padding:2px 6px;border-radius:4px;font-size:.92em}
h1{font-size:20px;font-weight:600}
li{margin:6px 0}
</style>
</head>
<body>
<h1>Ciallo～(∠・ω< )⌒☆</h1>
<p>这是自建的 pixiv 代理服务（Cloudflare Workers 版），同时承担两类转发：</p>
<ul>
<li><b>Pixiv App API</b>：<code>/pixiv-app-api/*</code> → app-api.pixiv.net，<code>/pixiv-oauth/*</code> → oauth.secure.pixiv.net</li>
<li><b>图片 CDN</b>：其余路径（如 <code>/img-master/...</code>）→ i.pximg.net，自动携带防盗链 Referer</li>
</ul>
<p>纯透传，服务端不存储任何账号令牌。</p>
</body>
</html>`

function respond(upstream, cacheControl) {
  const headers = new Headers(upstream.headers)
  headers.set('Access-Control-Allow-Origin', '*')
  headers.set('Cache-Control', cacheControl)
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}

export default {
  async fetch(request) {
    const url = new URL(request.url)
    const path = url.pathname

    if (path === '/') {
      return new Response(INFO_PAGE, {
        headers: { 'Content-Type': 'text/html; charset=UTF-8' },
      })
    }

    const isApi = path.startsWith('/pixiv-app-api/')
    const isOauth = path.startsWith('/pixiv-oauth/')

    try {
      if (isApi || isOauth) {
        const prefix = isApi ? '/pixiv-app-api' : '/pixiv-oauth'
        const origin = isApi ? APP_API_ORIGIN : OAUTH_ORIGIN
        const target = new URL(path.slice(prefix.length) + url.search, origin)

        const headers = new Headers(PIXIV_API_HEADERS)
        for (const key of FORWARDED_HEADERS) {
          const val = request.headers.get(key)
          if (val) headers.set(key, val)
        }

        const init = { method: request.method, headers }
        if (request.method !== 'GET' && request.method !== 'HEAD') {
          init.body = request.body
          init.duplex = 'half'
        }

        const upstream = await fetch(target.toString(), init)
        return respond(upstream, 'no-store')
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response('Method Not Allowed', { status: 405 })
      }

      const target = new URL(path + url.search, PXIMG_ORIGIN)
      const upstream = await fetch(target.toString(), {
        method: request.method,
        headers: {
          Referer: 'https://www.pixiv.net/',
          'User-Agent': CLIENT_UA,
          Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
      })
      return respond(upstream, 'public, max-age=604800, immutable')
    } catch (err) {
      return new Response('Bad Gateway: ' + (err && err.message ? err.message : 'unknown error'), {
        status: 502,
      })
    }
  },
}
