import './index.css';
import kaplay from 'kaplay'
import { colyseusSDK } from "./core/colyseus";
import { createGameScene } from './scenes/game';
import { createLobbyScene } from './scenes/lobby';
import type { MyRoomState } from '../../server/src/rooms/schema/MyRoomState';
import "./index.css";
import { GAME_HEIGHT, GAME_WIDTH } from "../../globals";

// 1. 初始化 KAPLAY 游戏引擎
// 设置背景颜色为深色 (十六进制 20252e)
export const k = kaplay({
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  letterbox: true,
  pixelDensity: Math.min(window.devicePixelRatio, 2), // crispier on phones
  background: "8db7ff",
  font: "happy-o",
});

// 2. 注册所有游戏场景
// 调用此函数会定义名为 "game" 的场景，但此时还没跳转
createLobbyScene();
createGameScene();

async function main() {
  await k.loadBitmapFont("happy-o", "./assets/happy-o.png", 31, 39);
  k.loadSound("hit", "sounds/hit.mp3");

  // // 在屏幕中央添加一个初始提示文字
  // const text = k.add([
  //   k.text("Joining room ..."), // 初始内容：正在加入房间
  //   k.pos(k.center()), // 位置：屏幕正中心
  //   k.anchor("center"), // 锚点：居中对齐
  //   k.text("Joining room ...", { size: 28 }),
  // ]);

  // // 4. 连接服务器房间
  // // joinOrCreate 会尝试加入现有房间，若没有则创建一个
  // // "my_room" 是房间类型的标识符
  // // 第二个参数是发送给服务器的自定义选项（如玩家昵称）
  // const room = await colyseusSDK.joinOrCreate<MyRoomState>("my_room", {
  //   name: "Ka"
  // });

  // // 5. 连接成功处理
  // // 更新屏幕上的文字，显示分配到的 sessionId
  // text.text = "Success! sessionId: " + room.sessionId;

  // 6. 跳转场景
  // 使用 k.go 跳转到 "lobby" 场景，并将获取到的 room 实例传递过去
  k.go("lobby");
}

main();
