// 配置并导出 Colyseus 服务器实例
// - 在这里注册房间类型（rooms）
// - 可挂载自定义 express 路由、playground（开发用）和 monitor（管理面板）
import { defineServer, defineRoom, monitor, playground, LobbyRoom } from "colyseus";

// 导入房间实现类（每个房间类型对应一个类）
// server/src/app.config.ts
import { VisualLobby } from "./rooms/VisualLobby";
import { MyRoom } from "./rooms/MyRoom"; // 你现有的对战房间

export const server = defineServer({
    // rooms：将字符串房间名映射到房间类
    rooms: {
        lobby: defineRoom(VisualLobby),
        // 客户端会用 roomName = "my_room" 来 joinOrCreate
        my_room: defineRoom(MyRoom).enableRealtimeListing(),
    },

    // express：在底层 Express 应用上挂载自定义 HTTP 路由 / 中间件
    express: (app) => {
        // 示例自定义路由
        app.get("/hello_world", (req, res) => {
            res.send("It's time to kick ass and chew bubblegum!");
        });

        // playground：开发时使用的交互界面（不要在生产环境随意暴露）
        if (process.env.NODE_ENV !== "production") {
            app.use("/", playground());
        }

        // monitor：Colyseus 提供的监控面板，推荐加访问控制
        app.use("/colyseus", monitor());
    },

    // beforeListen：在实际调用 listen 之前执行，可用于初始化或准备工作
    beforeListen: () => {
        // 可在此处执行数据库连接、缓存初始化等（当前留空）
    }
});

export default server;