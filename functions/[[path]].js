export async function onRequest(context) {
  const url = new URL(context.request.url);
  const targetHost = "sap-jprsqjtq.cfapps.jp01.hana.ondemand.com";
  
  // 1. 构造发往 SAP 的请求地址
  const targetUrl = `https://${targetHost}${url.pathname}${url.search}`;

  // 2. 复制请求头并修改 Host，防止被 SAP 拦截
  const newHeaders = new Headers(context.request.headers);
  newHeaders.set("Host", targetHost);
  newHeaders.set("Referer", `https://${targetHost}/`);

  // 3. 抓取 SAP 页面内容
  const response = await fetch(targetUrl, {
    method: context.request.method,
    headers: newHeaders,
    redirect: "manual" // 手动处理重定向
  });

  // 4. 处理重定向（防止登录或跳转时跳回原始 .hana.ondemand.com 域名）
  const resHeaders = new Headers(response.headers);
  const location = resHeaders.get("Location");
  if (location && location.includes(targetHost)) {
    resHeaders.set("Location", location.replace(targetHost, url.host));
  }

  // 5. 允许跨域（如果是导航站可能需要调用一些 API）
  resHeaders.set("Access-Control-Allow-Origin", "*");

  return new Response(response.body, {
    status: response.status,
    headers: resHeaders
  });
}
