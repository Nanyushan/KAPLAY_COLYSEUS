/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
// 入口文件：启动 Colyseus 服务器
// - 使用 @colyseus/tools 提供的 `listen` 方法启动 HTTP + WebSocket 服务
// - 实际的路由与房间配置由 `app.config` 导出
import { listen } from "@colyseus/tools";

// 导入服务器配置（rooms、express 路由、监控等）
import app from "./app.config";

// 启动服务器（默认端口 2567，或被环境变量 `PORT` 覆盖）
listen(app);
