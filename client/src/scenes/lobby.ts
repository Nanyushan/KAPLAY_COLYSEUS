import { k } from "../App";
import playground from "../objs/playground";
import { Callbacks, Room } from "@colyseus/sdk";
import { getStateCallbacks } from "@colyseus/sdk";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import player from "../objs/player";
import puck from "../objs/puck";
import score from "../objs/score";


export function createLobbyScene() {

  k.scene("lobby", (room: Room<MyRoomState>) => {

    k.add(playground());
    k.add(puck(room));
    k.add(score(room));

    // --- 对应图片中的修改部分 ---
    // 1. 获取状态回调助手 $
    const $ = getStateCallbacks(room);

    // 2. 使用 $ 包装房间状态以监听玩家添加
    $(room.state).players.onAdd((player, sessionId) => {
        
        // 监听该玩家实例的任何属性变化
        $(player).onChange(() => {
            console.log(`玩家 ${player.name} 状态更新了!`);
        });

        // 专门监听坐标 x 的变化
        $(player).listen("x", (x, prevX) => {
            console.log("玩家移动 X 到:", x, "原位置:", prevX);
        });

        // 专门监听坐标 y 的变化
        $(player).listen("y", (y, prevY) => {
            console.log("玩家移动 Y 到:", y, "原位置:", prevY);
        });

        // 原有的创建精灵逻辑
        // spritesBySessionId[sessionId] = createPlayer(player); 
    });

    const callbacks = Callbacks.get(room);

    // keep track of player sprites
    const spritesBySessionId: Record<string, any> = {};

    // listen when a player is added in server state
    // 使用一致的 callbacks 实例来监听
    callbacks.onAdd("players", async (player, sessionId) => {
      // 这里使用 playerState 变量名
      spritesBySessionId[sessionId] = await createPlayer(room, player);
    });


    // listen when a player is removed from server state
    callbacks.onRemove("players", (player, sessionId) => {
      k.destroy(spritesBySessionId[sessionId]);
    });

    k.onClick(() => {
      k.setCursorLocked(true);
    });

  });
}

async function createPlayer(room: Room<MyRoomState>, playerState: Player) {
  await k.loadSprite(playerState.avatar, `assets/${playerState.avatar}.png`);
  await k.getSprite(playerState.avatar);
  return k.add(player(room, playerState));
}
