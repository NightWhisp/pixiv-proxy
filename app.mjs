import http from 'node:http'
import { Readable } from 'node:stream'

const PORT = Number(process.env.PORT || 3000)

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
<title>pxve + pximg proxy</title>
<style>
body{font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;max-width:640px;margin:40px auto;padding:0 16px;color:#26215c;line-height:1.7}
code{background:#EEEDFE;padding:2px 6px;border-radius:4px;font-size:.92em}
h1{font-size:20px;font-weight:600}
li{margin:6px 0}
</style>
</head>
<body>
<h1>Ciallo～(∠・ω< )⌒☆</h1>
<p>这是自建的 pixiv 代理服务，同时承担两类转发：</p>
<ul>
<li><b>Pixiv App API</b>：<code>/pixiv-app-api/*</code> → app-api.pixiv.net，<code>/pixiv-oauth/*</code> → oauth.secure.pixiv.net</li>
<li><b>图片 CDN</b>：其余路径（如 <code>/img-master/...</code>）→ i.pximg.net，自动携带防盗链 Referer</li>
</ul>
<p>纯透传，服务端不存储任何账号令牌。</p>
</body>
</html>`

function sendUpstream(upstream, res, extraHeaders) {
  const headers = { ...extraHeaders }
  const ct = upstream.headers.get('content-type')
  if (ct) headers['Content-Type'] = ct
  const len = upstream.headers.get('content-length')
  if (len) headers['Content-Length'] = len
  res.writeHead(upstream.status, headers)
  return upstream.body ? Readable.fromWeb(upstream.body).pipe(res) : res.end()
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://placeholder')
  const path = url.pathname

  if (path === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' })
    res.end(INFO_PAGE)
    return
  }

  const isApi = path.startsWith('/pixiv-app-api/')
  const isOauth = path.startsWith('/pixiv-oauth/')

  try {
    if (isApi || isOauth) {
      const origin = isApi ? APP_API_ORIGIN : OAUTH_ORIGIN
      const prefix = isApi ? '/pixiv-app-api' : '/pixiv-oauth'
      const target = new URL(path.slice(prefix.length) + url.search, origin)

      const headers = { ...PIXIV_API_HEADERS }
      for (const key of FORWARDED_HEADERS) {
        const val = req.headers[key]
        if (val) headers[key] = Array.isArray(val) ? val.join(', ') : val
      }

      const init = { method: req.method, headers }
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        init.body = req
        init.duplex = 'half'
      }

      const upstream = await fetch(target.href, init)
      await new Promise(resolve => {
        const stream = sendUpstream(upstream, res, {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
        })
        if (stream) stream.on('end', resolve)
        else resolve()
        res.on('close', resolve)
      })
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method Not Allowed')
      return
    }

    const target = new URL(path + url.search, PXIMG_ORIGIN)
    const upstream = await fetch(target.href, {
      method: req.method,
      headers: {
        Referer: 'https://www.pixiv.net/',
        'User-Agent': CLIENT_UA,
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    await new Promise(resolve => {
      const stream = sendUpstream(upstream, res, {
        'Cache-Control': 'public, max-age=604800, immutable',
        'Access-Control-Allow-Origin': '*',
      })
      if (stream) stream.on('end', resolve)
      else resolve()
      res.on('close', resolve)
    })
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain' })
      res.end('Bad Gateway: ' + (err && err.message ? err.message : 'unknown error'))
    } else {
      res.destroy()
    }
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`pixiv proxy listening on 0.0.0.0:${PORT}`)
  console.log(`  /pixiv-app-api/* -> ${APP_API_ORIGIN}`)
  console.log(`  /pixiv-oauth/*   -> ${OAUTH_ORIGIN}`)
  console.log(`  /*               -> ${PXIMG_ORIGIN}`)
})
