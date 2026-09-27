export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetHost = "my-render-nezha.onrender.com";
  
  // 1. 拼接目标源站 URL
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  // 2. 构造请求头，清除可能导致源站卡死/拒接的代理 Header
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);
  
  // 清除 Cloudflare 节点自身 Header，防止源站判断异常
  newHeaders.delete("cf-connecting-ip");
  newHeaders.delete("cf-ray");
  newHeaders.delete("cf-visitor");
  newHeaders.delete("cf-ipcountry");
  newHeaders.delete("x-forwarded-proto");
  newHeaders.delete("x-real-ip");

  // 3. 构造请求配置
  const fetchOptions = {
    method: context.request.method,
    headers: newHeaders,
    redirect: "manual" // 手动处理重定向
  };

  // 4. 处理 POST / PUT 请求体
  if (!["GET", "HEAD"].includes(context.request.method)) {
    fetchOptions.body = context.request.body;
    fetchOptions.duplex = "half";
  }

  try {
    // 设置 15 秒超时，防止无休止卡住
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    fetchOptions.signal = controller.signal;

    const response = await fetch(targetUrl, fetchOptions);
    clearTimeout(timeoutId);

    // 5. 处理响应头
    const resHeaders = new Headers(response.headers);
    
    // 修正重定向，防止跳回 onrender.com
    const location = resHeaders.get("Location");
    if (location && location.includes(targetHost)) {
      resHeaders.set("Location", location.replace(targetHost, url.host));
    }

    // 允许跨域
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      return new Response("Render 源站响应超时，可能正在冷启动，请刷新重试！", { status: 504 });
    }
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}
