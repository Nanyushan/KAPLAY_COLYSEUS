// src/scenes/game.ts
import { k } from "../App";
import { colyseusSDK } from "../core/colyseus";
import playground from "../objs/playground";
import { Callbacks, Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import player from "../objs/player";
import puck from "../objs/puck";
import score from "../objs/score";

export function createGameScene() {
  // 接收从 lobby 传来的参数

  k.scene("game", async (params: { mode?: string, roomId?: string, roomName?: string } = {}) => {

    k.onSceneLeave(() => {
      if (room && room.connection.isOpen) {
        room.removeAllListeners();
        room.leave();
      }
    });

    // 恢复对战场景的背景色
    k.setBackground(k.Color.fromHex("#8db7ff"));

    // 1. 显示加载提示
    const loadingText = k.add([
      k.text("Connecting to Game...", { size: 28 }),
      k.pos(k.center()),
      k.anchor("center")
    ]);

    let room: Room<MyRoomState>;

    // 2. 根据大厅传来的模式，执行不同的连接逻辑
    try {
      if (params.mode === "join" && params.roomId) {
        // 加入指定的房间
        room = await colyseusSDK.joinById<MyRoomState>(params.roomId, { name: "Ka" });
      } else if (params.mode === "create") {
        // 创建带有自定义名字的房间
        room = await colyseusSDK.create<MyRoomState>("my_room", {
          name: "Ka",
          roomName: params.roomName || "未命名房间"
        });
      } else {
        // 兜底/快速匹配：加入或创建
        room = await colyseusSDK.joinOrCreate<MyRoomState>("my_room", { name: "Ka" });
      }

      // 连接成功，销毁加载提示
      k.destroy(loadingText);
      console.log("成功进入对战房间！房间 ID:", room.roomId);

    } catch (e) {
      // 连接失败处理
      console.error("进入游戏房间失败:", e);
      loadingText.text = "Connection Failed! Returning to lobby...";
      // 等待 2 秒后退回大厅
      await k.wait(2, () => {
        k.go("lobby");
      });
      return;
    }

    // ==========================================
    // 3. 原有的对战场景渲染逻辑
    // ==========================================
    k.add(playground(room));
    k.add(puck(room));
    k.add(score(room));

    // 获取状态回调助手 $
    const $ = getStateCallbacks(room);

    // 使用 $ 包装房间状态以监听玩家添加
    $(room.state).players.onAdd((playerObj, sessionId) => {
      $(playerObj).onChange(() => {
        // console.log(`玩家 ${playerObj.name} 状态更新了!`);
      });

      $(playerObj).listen("x", (x, prevX) => {
        // console.log("玩家移动 X 到:", x, "原位置:", prevX);
      });

      $(playerObj).listen("y", (y, prevY) => {
        // console.log("玩家移动 Y 到:", y, "原位置:", prevY);
      });
    });

    const callbacks = Callbacks.get(room);

    // keep track of player sprites
    const spritesBySessionId: Record<string, any> = {};

    // listen when a player is added in server state
    callbacks.onAdd("players", async (playerState, sessionId) => {
      spritesBySessionId[sessionId] = await createPlayer(room, playerState);
    });

    // listen when a player is removed from server state
    callbacks.onRemove("players", (playerState, sessionId) => {
      if (spritesBySessionId[sessionId]) {
        k.destroy(spritesBySessionId[sessionId]);
        delete spritesBySessionId[sessionId];
      }
    });

    // 鼠标锁定机制 (避开左上角的退出按钮区域)
    k.onClick(() => {
      const pos = k.mousePos();
      if (pos.x > 150 || pos.y > 80) {
        k.setCursorLocked(true);
      }
    });

    // ==========================================
    // 4. 增加一个“返回大厅”的退出按钮 (父子绑定版)
    // ==========================================
    const btnX = 20;
    const btnY = 20;

    // 只创建一个底框，文字挂在它身上
    const backBtnBg = k.add([
      k.rect(100, 40, { radius: 8 }),
      k.pos(btnX, btnY),
      k.color(k.rgb(200, 50, 50)),
      k.area(),
      k.fixed(),
      k.z(100)
    ]);

    // 文字作为子元素添加，(50, 20) 是相对底框的局部坐标（正中心）
    backBtnBg.add([
      k.text("Quit", { size: 18, font: "monospace" }),
      k.anchor("center"),
      k.pos(50, 20),
      k.color(255, 255, 255)
    ]);

    backBtnBg.onClick(async () => {
      k.setCursorLocked(false);

      if (room && room.connection.isOpen) {
        room.removeAllListeners();
        // 强制通知服务器，并稍微等待一下
        await room.leave();
      }

      k.go("lobby");
    });

    // ==========================================
    // 5. 动态人数等待 UI
    // ==========================================
    const statusLabel = k.add([
      k.text("Waiting for players...", { size: 24, font: "monospace" }),
      k.pos(k.center()),
      k.anchor("center"),
      k.z(2000), // 确保在最上层
      k.fixed()
    ]);

    // // 监听房间状态和人数变化
    // const $ = getStateCallbacks(room);

    // 监听状态改变
    $(room.state).listen("status", (status) => {
      if (status === "playing") {
        k.destroy(statusLabel); // 游戏开始，销毁提示
      }
    });

    // 监听人数改变以更新进度
    $(room.state.players).onAdd(() => updateStatusText());
    $(room.state.players).onRemove(() => updateStatusText());

    function updateStatusText() {
      if (room.state.status !== "playing") {
        statusLabel.text = `Waiting... (${room.state.players.size}/${room.state.maxClients})`;
      }
    }
    updateStatusText(); // 初始执行一次

  });
}

// 提取的玩家创建助手函数
async function createPlayer(room: Room<MyRoomState>, playerState: Player) {
  // 确保使用正确的头像资源名称
  const avatarName = playerState.avatar || "bean";
  await k.loadSprite(avatarName, `assets/${avatarName}.png`);
  return k.add(player(room, playerState));
}