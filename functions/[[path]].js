export async function onRequest(context) {
  const url = new URL(context.request.url);
  // 目标源站：你的 Render 哪吒探针地址
  const targetHost = "my-render-nezha.onrender.com";
  
  // 1. 构造发往 Render 源站的完整请求地址
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  // 2. 复制并重写请求头，确保 Host 与 Referer 一致，防止 Render 拦截
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);
  
  // 清理 Cloudflare 节点标头，避免源站判别异常
  newHeaders.delete("cf-connecting-ip");
  newHeaders.delete("cf-ray");
  newHeaders.delete("cf-visitor");

  // 3. 构造请求配置参数
  const fetchOptions = {
    method: context.request.method,
    headers: newHeaders,
    redirect: "manual" // 手动处理重定向跳转
  };

  // 4. 透传 POST / PUT 等非 GET/HEAD 请求的 Body 内容（如面板登录、修改配置）
  if (!["GET", "HEAD"].includes(context.request.method)) {
    fetchOptions.body = context.request.body;
    fetchOptions.duplex = "half"; // 启用流式传输
  }

  try {
    // 5. 向 Render 发起反向代理请求
    const response = await fetch(targetUrl, fetchOptions);

    // 6. 处理返回的响应头
    const resHeaders = new Headers(response.headers);
    
    // 如果 Render 返回了重定向（301/302），将 Location 中的 TargetHost 替换为当前自定义域名，防止跳回 .onrender.com
    const location = resHeaders.get("Location");
    if (location && location.includes(targetHost)) {
      resHeaders.set("Location", location.replace(targetHost, url.host));
    }

    // 设置跨域标头
    resHeaders.set("Access-Control-Allow-Origin", "*");
    resHeaders.set("Access-Control-Allow-Credentials", "true");

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: resHeaders
    });
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}
