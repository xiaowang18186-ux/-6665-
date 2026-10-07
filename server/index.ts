import { ENV } from "./config/env";
import { createApp } from "./app";

if (!ENV.adminToken) console.warn("[admin] 未配置 ADMIN_TOKEN，/admin 后台接口已禁用");
else if (!ENV.isProd) console.warn("[admin] 开发模式默认令牌：dev-admin-token（生产环境请设置 ADMIN_TOKEN）");

createApp(undefined, { serveStatic: ENV.isProd }).listen(ENV.port, () => {
  console.log(`[server] http://localhost:${ENV.port}`);
});
