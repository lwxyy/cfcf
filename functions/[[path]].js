export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const targetHost = "my-render-nezha.onrender.com";

  // 1. 判断是否为 WebSocket 握手请求
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    // 构造发往 Render 源站的 WebSocket URL (https -> wss)
    const targetWsUrl = `wss://${targetHost}${url.pathname}${url.search}`;
    
    // 复制请求头并重写 Host
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetHost);
    newHeaders.set("Referer", `https://${targetHost}/`);

    // 直接使用 fetch 处理 WebSocket 升级请求，Cloudflare 会自动进行 WebSocket 代理转发
    return fetch(targetWsUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.body
    });
  }

  // 2. 普通 HTTP/HTTPS 请求转发
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  const newHeaders = new Headers(request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);

  // 清理可能导致冲突的标头
  newHeaders.delete("cf-connecting-ip");
  newHeaders.delete("cf-ray");
  newHeaders.delete("cf-visitor");

  const fetchOptions = {
    method: request.method,
    headers: newHeaders,
    redirect: "manual"
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    fetchOptions.body = request.body;
    fetchOptions.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);

    const resHeaders = new Headers(response.headers);
    
    // 重写 Location 防止重定向跳回 onrender.com
    const location = resHeaders.get("Location");
    if (location && location.includes(targetHost)) {
      resHeaders.set("Location", location.replace(targetHost, url.host));
    }

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
