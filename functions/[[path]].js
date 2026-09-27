export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetHost = "my-render-nezha.onrender.com";

  // 1. 处理 WebSocket / 双向升级连接（哪吒面板实时数据传输的关键）
  const upgradeHeader = context.request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    // 将 ws:// 或 wss:// 指向 Render
    const wsUrl = `wss://${targetHost}${url.pathname}${url.search}`;
    
    const wsHeaders = new Headers(context.request.headers);
    wsHeaders.set("Host", targetHost);
    wsHeaders.set("Referer", `https://${targetHost}/`);

    // 直接透传 WebSocket 请求
    return fetch(wsUrl, {
      method: context.request.method,
      headers: wsHeaders,
      body: context.request.body
    });
  }

  // 2. 构造 HTTP/HTTPS 转发请求
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  // 复制请求头，并彻底清理干扰 Header
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);

  // 删除容易引起死锁和连接挂起的代理标头
  const headersToRemove = [
    "cf-connecting-ip", "cf-ray", "cf-visitor", "cf-ipcountry",
    "x-forwarded-proto", "x-real-ip", "connection", "keep-alive"
  ];
  headersToRemove.forEach(h => newHeaders.delete(h));

  const fetchOptions = {
    method: context.request.method,
    headers: newHeaders,
    redirect: "manual"
  };

  // 仅在非 GET/HEAD 请求时透传请求体
  if (!["GET", "HEAD"].includes(context.request.method)) {
    fetchOptions.body = context.request.body;
    fetchOptions.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    const resHeaders = new Headers(response.headers);

    // 重写 Location 响应标头，防止重定向跳回 .onrender.com
    const location = resHeaders.get("Location");
    if (location && location.includes(targetHost)) {
      resHeaders.set("Location", location.replace(targetHost, url.host));
    }

    // CORS 支持
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders
    });
  } catch (err) {
    return new Response(`Proxy Connection Error: ${err.message}`, { status: 502 });
  }
}
