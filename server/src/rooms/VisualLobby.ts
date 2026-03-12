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
            // 👉 强化聊天：加上 sessionId，让客户端知道是谁在说话
            this.broadcast("chat_update", {
                sessionId: client.sessionId,
                sender: player?.name || "未知",
                content: content
            });
        });

        this.setSimulationInterval(async () => {
            try {
                const rooms = await matchMaker.query({ name: "my_room" });
                this.broadcast("game_rooms_update", rooms);
            } catch (e) {
                console.error("Matchmaker query error:", e);
            }
        }, 1000);
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