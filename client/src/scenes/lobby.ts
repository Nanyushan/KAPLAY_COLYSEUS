// src/scenes/lobby.ts
import { k } from "../App";
import { colyseusSDK } from "../core/colyseus";
// 引入服务端的大厅状态类型（路径请根据你的实际项目结构调整）
import type { LobbyState, LobbyPlayer } from "../../../server/src/rooms/schema/LobbyState";
import type { Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";


export function createLobbyScene() {
    k.scene("lobby", async () => {
        // 设置大厅背景色
        k.setBackground(k.Color.fromHex("#2C3E50"));

        // 提示正在连接
        const loadingText = k.add([
            k.text("Entering Visual Lobby...", { size: 24 }),
            k.pos(k.center()),
            k.anchor("center"),
        ]);

        let room: Room<LobbyState>;
        try {
            // 1. 连接到可视化大厅
            room = await colyseusSDK.joinOrCreate<LobbyState>("lobby", {
                name: "玩家" + Math.floor(Math.random() * 1000), // 随机给个默认名字
                avatar: "bean" // 默认头像
            });
            k.destroy(loadingText);
        } catch (e) {
            loadingText.text = "Connection Failed!";
            console.error("连接大厅失败:", e);
            return;
        }

        // 存放所有玩家精灵的引用
        const playerSprites: Record<string, any> = {};

        // 页面关闭时的终极清理术（防止幽灵玩家）
        const handleUnload = () => {
            if (room && room.connection.isOpen) room.leave();
        };
        window.addEventListener("beforeunload", handleUnload);

        // 离开大厅场景时，卸载清理事件，防止内存泄漏
        k.onSceneLeave(() => {
            window.removeEventListener("beforeunload", handleUnload);
        });

        // ==========================================
        // 模块 1：玩家视觉同步 (防堵塞 + 顺滑插值版)
        // ==========================================
        const $ = getStateCallbacks(room);

        $(room.state).players.onAdd((player: LobbyPlayer, sessionId: string) => {
            // ⚠️ 修复 1：用 async 自执行函数包裹，绝对不阻塞其他玩家的同步！
            (async () => {
                const avatarName = player.avatar || "bean";

                try {
                    await k.loadSprite(avatarName, `assets/${avatarName}.png`);
                } catch (e) {
                    // 忽略重复加载的报错，保证代码继续执行
                }

                // 如果在这零点几秒的加载期间，玩家退出了，就不渲染了
                if (!room.state.players.has(sessionId)) return;

                const startX = player.x || k.width() / 2;
                const startY = player.y || k.height() / 2;

                const playerObj = k.add([
                    k.sprite(avatarName),
                    k.pos(startX, startY),
                    k.anchor("center"),
                    k.z(10),
                    "lobby_player",
                    {
                        targetX: startX,
                        targetY: startY,
                    }
                ]);

                playerObj.add([
                    k.text(player.name, { size: 14 }),
                    k.pos(0, -30),
                    k.anchor("center"),
                    k.color(255, 255, 255)
                ]);

                playerSprites[sessionId] = playerObj;

                // 监听服务器传来的坐标（其他玩家的移动靠这个更新）
                $(player).listen("x", (newX: number) => { playerObj.targetX = newX; });
                $(player).listen("y", (newY: number) => { playerObj.targetY = newY; });

                playerObj.onUpdate(() => {
                    const dist = playerObj.pos.dist(k.vec2(playerObj.targetX, playerObj.targetY));

                    // ⚠️ 修复 2：如果距离超过 200（比如刚进大厅），直接瞬移，防止从屏幕外慢慢飘过来
                    if (dist > 200) {
                        playerObj.pos.x = playerObj.targetX;
                        playerObj.pos.y = playerObj.targetY;
                    } else {
                        // 距离近就平滑滑动 (15 是滑动速度，越高越跟手)
                        playerObj.pos.x = k.lerp(playerObj.pos.x, playerObj.targetX, k.dt() * 15);
                        playerObj.pos.y = k.lerp(playerObj.pos.y, playerObj.targetY, k.dt() * 15);
                    }
                });
            })();
        });

        $(room.state).players.onRemove((player: LobbyPlayer, sessionId: string) => {
            if (playerSprites[sessionId]) {
                k.destroy(playerSprites[sessionId]);
                delete playerSprites[sessionId];
            }
        });

        // ==========================================
        // 模块 2：本地玩家控制 (客户端预测，零延迟手感！)
        // ==========================================
        const panelX = k.width() - 300;

        // ⚠️ 修复 3：改用 onMousePress，它比 onClick 更底层，绝不会被残留的 UI 吞掉事件
        k.onMousePress(() => {
            const mPos = k.mousePos();

            if (mPos.x < panelX && room) {
                // 1. 发给服务器，让别人看到你动
                room.send("move", { x: mPos.x, y: mPos.y });

                // 2. ⚠️ 核心魔法：客户端预测 (Client Prediction)
                // 不等服务器慢吞吞的回复，你自己的小人立刻、马上开始移动！彻底消除卡顿感！
                const localPlayer = playerSprites[room.sessionId];
                if (localPlayer) {
                    localPlayer.targetX = mPos.x;
                    localPlayer.targetY = mPos.y;
                }
            }
        });

        // ==========================================
        // 模块 3：简易聊天系统 (安全版)
        // ==========================================
        const chatLog = k.add([
            // 关键修复 1：强制使用系统自带字体 "monospace"，绕过 happy-o 位图字体限制
            k.text("Press ENTER to chat", { size: 18, font: "monospace" }),
            k.pos(20, k.height() - 60), // 稍微往上抬一点，防止被屏幕边缘裁切
            k.fixed(),
            k.z(100),
        ]);

        let messages: string[] = [];
        room.onMessage("chat_update", (data: { sender: string, content: string }) => {
            messages.push(`[${data.sender}]: ${data.content}`);
            if (messages.length > 5) messages.shift();
            chatLog.text = messages.join("\n");
        });

        k.onKeyPress("enter", () => {
            const msg = prompt("请输入聊天内容 (建议英文):");
            if (msg && msg.trim() !== "") {
                room.send("chat", msg.trim());
            }
        });

        // ==========================================
        // 模块 4：动态房间列表与匹配面板 (扁平渲染 + 彻底卸载监听)
        // ==========================================
        const panelWidth = 300;

        // 1. 右侧深灰色背景面板
        k.add([
            k.rect(panelWidth, k.height()),
            k.pos(panelX, 0),
            k.color(k.rgb(40, 40, 40)),
            k.fixed(),
            k.z(50),
        ]);

        // 2. 标题
        k.add([
            k.text("Game Rooms", { size: 24 }),
            k.pos(panelX + 20, 20),
            k.color(k.rgb(255, 255, 255)),
            k.fixed(),
            k.z(51)
        ]);

        // 3. 创建房间按钮
        const createBtnBg = k.add([
            k.rect(260, 50, { radius: 8 }),
            k.pos(panelX + 20, k.height() - 80),
            k.color(k.rgb(46, 204, 113)),
            k.area(),
            k.fixed(),
            k.z(51),
        ]);

        k.add([
            k.text("Create Room", { size: 20 }),
            k.pos(panelX + 130, k.height() - 55),
            k.anchor("center"),
            k.color(k.rgb(255, 255, 255)),
            k.fixed(),
            k.z(52)
        ]);

        // 👉 修改点 1：创建房间时的彻底断开
        createBtnBg.onClick(() => {
            const roomName = prompt("请输入房间名：", "New Room");
            if (roomName) {
                room.removeAllListeners(); // 彻底拔掉大厅的“网线”
                room.leave();              // 告诉大厅服务器“我走了”
                k.go("game", { mode: "create", roomName: roomName });
            }
        });

        // 4. 房间列表动态渲染
        let roomUIElements: any[] = [];

        room.onMessage("game_rooms_update", (rooms: any[]) => {
            // 核心优化：在渲染新列表前，确保销毁所有旧的 room_card 标签元素
            k.destroyAll("room_card");
            roomUIElements.forEach(item => k.destroy(item));
            roomUIElements = [];

            rooms.forEach((gameRoom, index) => {
                // 过滤掉那些已经在销毁边缘或者不该显示的空房间
                if (gameRoom.clients <= 0) return;
                const isFull = gameRoom.clients >= gameRoom.maxClients;
                const startX = panelX + 20;
                const startY = 80 + index * 70;

                const cardBg = k.add([
                    k.rect(260, 60, { radius: 8 }),
                    k.pos(startX, startY),
                    k.color(isFull ? k.rgb(150, 150, 150) : k.rgb(52, 152, 219)),
                    k.area(),
                    k.fixed(),
                    k.z(51),
                ]);

                const rName = gameRoom.metadata?.roomName || "Room";
                const cardText = k.add([
                    k.text(`${rName} (${gameRoom.clients}/${gameRoom.maxClients})`, { size: 16 }),
                    k.pos(startX + 15, startY + 20),
                    k.color(k.rgb(255, 255, 255)),
                    k.fixed(),
                    k.z(52),
                ]);

                roomUIElements.push(cardBg, cardText);

                // 👉 修改点 2：加入房间时的彻底断开
                cardBg.onClick(() => {
                    if (!isFull) {
                        room.removeAllListeners(); // 彻底拔掉大厅的“网线”
                        room.leave();              // 告诉大厅服务器“我走了”
                        k.go("game", { mode: "join", roomId: gameRoom.roomId });
                    } else {
                        alert("房间已满！");
                    }
                });
            });
        });

    });

}
