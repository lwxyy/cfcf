export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // 将请求的目标地址修改为你的 SAP BTP 地址
    const targetUrl = "https://sap-jprsqjtq.cfapps.jp01.hana.ondemand.com" + url.pathname + url.search;

    // 复制原始请求的 Header，但需要修改 Host
    const newHeaders = new Headers(request.headers);
    newHeaders.set("Host", "sap-jprsqjtq.cfapps.jp01.hana.ondemand.com");
    newHeaders.set("Referer", "https://sap-jprsqjtq.cfapps.jp01.hana.ondemand.com/");

    // 发起转发请求
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: newHeaders,
      body: request.body,
      redirect: "manual" // 建议手动处理重定向，避免域名跳回原地址
    });

    // 处理响应，如果是重定向（301/302），需要将 Location 改回你的自定义域名
    if ([301, 302, 307, 308].includes(response.status)) {
      const location = response.headers.get("Location");
      if (location && location.includes("sap-jprsqjtq.cfapps.jp01.hana.ondemand.com")) {
        const newLocation = location.replace("sap-jprsqjtq.cfapps.jp01.hana.ondemand.com", url.host);
        const resHeaders = new Headers(response.headers);
        resHeaders.set("Location", newLocation);
        return new Response(response.body, {
          status: response.status,
          headers: resHeaders
        });
      }
    }

    return response;
  }
};
