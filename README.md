# pixiv-proxy

自用的 pixiv 代理服务，给 [Pixive](https://github.com/sad-hotpot-and-dog/Pixive)（Android 第三方客户端）用。**一个服务同时干两件事**：

| 路径 | 转发到 | 用途 |
|---|---|---|
| `/pixiv-app-api/*` | `app-api.pixiv.net` | App API 透传（榜单、搜索、详情、书签、评论等） |
| `/pixiv-oauth/*` | `oauth.secure.pixiv.net` | OAuth 登录/刷新令牌 |
| 其余路径（如 `/img-master/...`） | `i.pximg.net` | 图片 CDN 反代，自动携带防盗链 Referer |

- 纯透传，**服务端不存储任何账号令牌**（Authorization 只从客户端转发给 pixiv 官方）
- 两个实现均零第三方依赖：Node 版用原生 `http` + `fetch`（Node.js ≥ 18），Workers 版用 Web `fetch` 标准 API

## 在 Pixive 里怎么填

两个设置框填**同一个地址**（即本服务的部署域名）：

- 设置 → PxveAPI 代理 → `https://你的域名`
- 设置 → 图片代理 → `https://你的域名`

## 本地运行

```bash
node app.mjs          # 默认 3000 端口
PORT=8080 node app.mjs
```

访问 `http://localhost:3000/` 应看到说明页。

## 部署

> **⚠️ 中国大陆网络必读（2026-10 实测教训，部署前先看，能省一整夜）**
>
> 1. **不要用 Cloudflare Workers 的 `*.workers.dev` 默认域名**：该域名已被国内运营商在 TCP 层阻断（DNS 正常、连接直接超时）。Workers 本身没问题，但必须**绑定自己的自定义域名**才能国内访问。
> 2. **服务必须跑在境外节点**（境外服务器或海外 Serverless 区域）：国内服务器/国内 CDN 节点到 `app-api.pixiv.net` 和 `i.pximg.net` 全部超时（国内出口与家宽同一道墙）。
> 3. **EdgeOne Pages 默认域名**（`*.edgeone.cool` / `*.edgeone.dev`）对含中国大陆加速区域的项目返回 401（预览域合规 token 机制，控制台无开关），Pixive 填不了，必须绑自定义域名（海外节点项目绑域名免 ICP 备案）。
> 4. **其他平台门槛**：Render 免费档需绑 Visa/万事达才能创建服务，且闲置 15 分钟休眠、冷启动 30 秒以上；Vercel 新注册需人工审批；Zeabur 常驻服务需 $5/月 Dev 方案（前 14 天免费）。
> 5. **国内可达的稳妥路径**：自有境外 VPS（首选——如 Oracle Cloud Always Free，ARM 4核24G / 10TB 月流量 / 真永久免费，东京或首尔节点，`app.mjs` 直接扔 + systemd 守护）；或任意支持 Node 的境外平台；或买域名绑 Cloudflare 自定义域名。
> 6. **本仓库源码不含任何密钥**（仅上游目标域名），可安全公开；如需 HTTPS 但没域名，可用免费 DDNS（DuckDNS / desec.io）+ Let's Encrypt。

仓库内含**两个实现**，功能完全一致，按平台选一个用：

| 文件 | 运行方式 | 适合平台 |
|---|---|---|
| `app.mjs` | Node HTTP 服务（监听 `PORT`，绑定 `0.0.0.0`） | Render / Fly.io / Railway / 自有服务器 |
| `worker.js` + `wrangler.toml` | Cloudflare Workers handler | Cloudflare Workers（免费额度足够个人使用） |

### 部署到 Cloudflare Workers（免费；国内用户必须绑自定义域名，见上文警告 1）

无需本地工具链，网页面板一键导入：

1. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com/) → 左侧 **Workers & Pages** → **Create** → **Import a repository**（首次使用需授权 GitHub 并选择本仓库）
2. 保持默认构建配置（Workers 无需 build 命令），点 **Deploy**
3. 部署完成后获得地址 `https://pixiv-proxy.<你的子域>.workers.dev`
4. 把该地址填入 Pixive 的两个代理设置框

注意：worker 名称取自 `wrangler.toml` 里的 `name`，修改后需重新部署。

### 部署到其他平台

任何能跑「单端口 HTTP 服务」的平台都行，`start` 命令即 `node app.mjs`，需监听 `PORT` 环境变量并绑定 `0.0.0.0`：

- Render / Fly.io / Railway / 自己的服务器或软路由：直接部署本仓库即可
- Vercel：需再改 serverless handler 写法（`export default app`），需要的话告诉我
- 注意：GitHub Pages 只能托管静态站，**跑不了**这个服务；GitHub 仓库仅作源码备份和部署入口

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 监听端口 | `3000` |

## 致谢与许可

API 透传逻辑移植自 [susulqx/pxve-api](https://github.com/susulqx/pxve-api)（上游 [asadahimeka/pxve-api](https://github.com/asadahimeka/pxve-api)，MIT）。图片反代防盗链方案参考 [pixiv.cat](https://pixiv.cat/reverseproxy.html)。

本项目以 [MIT](./LICENSE) 许可发布。
