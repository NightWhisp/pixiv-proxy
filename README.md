# pixiv-proxy

自用的 pixiv 代理服务，给 [Pixive](https://github.com/sad-hotpot-and-dog/Pixive)（Android 第三方客户端）用。**一个服务同时干两件事**：

| 路径 | 转发到 | 用途 |
|---|---|---|
| `/pixiv-app-api/*` | `app-api.pixiv.net` | App API 透传（榜单、搜索、详情、书签、评论等） |
| `/pixiv-oauth/*` | `oauth.secure.pixiv.net` | OAuth 登录/刷新令牌 |
| 其余路径（如 `/img-master/...`） | `i.pximg.net` | 图片 CDN 反代，自动携带防盗链 Referer |

- 纯透传，**服务端不存储任何账号令牌**（Authorization 只从客户端转发给 pixiv 官方）
- 零第三方依赖，Node.js ≥ 18 原生 `http` + `fetch`

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

任何能跑「单端口 HTTP 服务」的平台都行，代码原样可用，`start` 命令即 `node app.mjs`，需监听 `PORT` 环境变量并绑定 `0.0.0.0`：

- Render / Fly.io / Railway / 自己的服务器或软路由：直接部署本仓库即可
- Vercel / Cloudflare Workers：需改成 serverless handler 写法（`export default app` / `export default { fetch }`），不能直接跑 `listen()`——需要的话告诉我，我出改写版
- 注意：GitHub Pages 只能托管静态站，**跑不了**这个服务；GitHub 仓库仅作源码备份和部署入口

## 环境变量

| 变量 | 说明 | 默认 |
|---|---|---|
| `PORT` | 监听端口 | `3000` |

## 致谢与许可

API 透传逻辑移植自 [susulqx/pxve-api](https://github.com/susulqx/pxve-api)（上游 [asadahimeka/pxve-api](https://github.com/asadahimeka/pxve-api)，MIT）。图片反代防盗链方案参考 [pixiv.cat](https://pixiv.cat/reverseproxy.html)。

本项目以 [MIT](./LICENSE) 许可发布。
