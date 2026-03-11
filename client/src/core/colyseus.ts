import { Client } from "@colyseus/sdk";

// 创建并导出 Colyseus 客户端实例
// 它会自动根据当前页面的协议（http/https）和域名（host）来拼接服务器地址
// 最后的 "/colyseus" 是服务器端监听 WebSocket 的端点（Endpoint）
export const colyseusSDK = new Client(`${location.protocol}//${location.host}/colyseus`);

