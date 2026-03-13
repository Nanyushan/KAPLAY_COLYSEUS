// server/src/rooms/VisualLobby.ts
// 可视化大厅房间（VisualLobby）
// 说明：该文件实现一个用于展示/管理大厅（lobby）的 Colyseus 房间。
// - 使用 LobbyState 保存在线玩家与聊天记录
// - 周期性查询 matchMaker 并将可加入的游戏房间列表广播给大厅客户端
// - 处理玩家移动与聊天消息，并将结果广播或写回状态
import { Room, Client, matchMaker } from "colyseus";
import { LobbyState, LobbyPlayer } from "./schema/LobbyState";

// 注意：Colyseus 的 Room 泛型期望是一个包含 state/metadata/client 的选项类型
// 因此我们使用 Room<{ state: LobbyState }> 来声明房间的状态类型
export class VisualLobby extends Room<{ state: LobbyState }> {
    // 限制最大连接数（达到后将不允许更多客户端加入）
    maxClients = 30; // 容纳二三十人

    onCreate(options: any) {
        this.setState(new LobbyState());

        this.onMessage("move", (client: Client, data: { x: number, y: number }) => {
            const player = this.state.players.get(client.sessionId);
            if (player) {
                player.x = data.x;
                player.y = data.y;
            }
        });

        this.onMessage("chat", (client: Client, content: string) => {
            const player = this.state.players.get(client.sessionId);
            // 加上 sessionId，让客户端知道是谁在说话
            this.broadcast("chat_update", {
                sessionId: client.sessionId,
                sender: player?.name || "未知",
                content: content
            });
        });

        // 快速开始匹配逻辑
        this.onMessage("quick_start", async (client: Client) => {
            try {
                // 1. 查询所有正在运行的对战房间列表
                const rooms = await matchMaker.query({ name: "my_room" });

                // 2. 筛选出处于 'waiting' 状态且未满员的房间
                // 优先选择人数较多但没满的房间，以促成快速开赛
                const availableRooms = rooms
                    .filter(r => 
                        r.metadata?.status === "waiting" && 
                        r.clients < r.maxClients
                    )
                    .sort((a, b) => b.clients - a.clients); // 按人数降序排序

                if (availableRooms.length > 0) {
                    // 找到最合适的房间，把 ID 发回给客户端
                    client.send("match_result", { 
                        roomId: availableRooms[0].roomId 
                    });
                } else {
                    // 没有合适房间，通知客户端去创建一个新房
                    client.send("match_result", { 
                        roomId: null,
                        reason: "no_available_room" 
                    });
                }
            } catch (e) {
                console.error("快速匹配查询失败:", e);
                client.send("match_result", { error: "Matchmaking error" });
            }
        });

        // 每秒查询一次匹配器中的可用游戏房间列表，并广播给所有连接的大厅客户端。
        // 这样前端可以实时更新“可加入的游戏”面板。
        // 这里使用 try/catch 以避免查询失败导致整个房间崩溃。
        // matchMaker.query 返回 Promise，因此我们在回调函数中使用 async/await。
        // 第二个参数 1000 表示间隔毫秒数（1 秒）。
        this.setSimulationInterval(async () => {
            try {
                const rooms = await matchMaker.query({ name: "my_room" });
                // 向所有客户端推送 game_rooms_update 事件，携带房间列表
                this.broadcast("game_rooms_update", rooms);
            } catch (e) {
                console.error("Matchmaker query error:", e);
            }
        }, 10);
    }

    onJoin(client: Client, options: any) {
        const player = new LobbyPlayer();
        player.name = options.name || "游客";
        player.avatar = options.avatar || "bean";

        // 👉 核心修复：给个随机坐标，坚决不让他们出生时重叠！
        player.x = Math.random() * 500 + 100;
        player.y = Math.random() * 400 + 100;

        this.state.players.set(client.sessionId, player);
    }

    onLeave(client: Client, code: number) {
        this.state.players.delete(client.sessionId);
    }
}