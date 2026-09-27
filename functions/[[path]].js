export async function onRequest(context) {
  const request = context.request;
  const url = new URL(request.url);
  const targetHost = "my-render-nezha.onrender.com";

  // 1. WebSocket 双向管道处理（解决 WebSocket 卡“连接中”的核心）
  const upgradeHeader = request.headers.get("Upgrade");
  if (upgradeHeader && upgradeHeader.toLowerCase() === "websocket") {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 构造发往 Render 的后端 WebSocket URL
    const targetWsUrl = `wss://${targetHost}${url.pathname}${url.search}`;
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", targetHost);
    newHeaders.set("Referer", `https://${targetHost}/`);

    // 向 Render 建立后端 WebSocket 连接
    const backendResponse = await fetch(targetWsUrl, {
      headers: newHeaders,
      webSocket: server,
    });

    // 接受客户端升级并建立双向透传
    server.accept();

    return new Response(null, {
      status: 101,
      webSocket: client,
      headers: backendResponse.headers,
    });
  }

  // 2. 普通 HTTP 请求透传
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;
  const newHeaders = new Headers(request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);

  newHeaders.delete("cf-connecting-ip");
  newHeaders.delete("cf-ray");

  const fetchOptions = {
    method: request.method,
    headers: newHeaders,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    fetchOptions.body = request.body;
    fetchOptions.duplex = "half";
  }

  try {
    const response = await fetch(targetUrl, fetchOptions);
    const resHeaders = new Headers(response.headers);

    const location = resHeaders.get("Location");
    if (location && location.includes(targetHost)) {
      resHeaders.set("Location", location.replace(targetHost, url.host));
    }

    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders,
    });
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}
