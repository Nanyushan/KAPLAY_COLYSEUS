import { Room, Client } from "@colyseus/core";
import { MyRoomState, Player } from "./schema/MyRoomState";
import { GAME_HEIGHT, GAME_WIDTH } from "../../../globals";

// 预定义的头像列表，用于给新加入的玩家随机分配 sprite 名称
const avatars = [
  'glady', 'dino', 'bean', 'bag', 'btfly', 'bobo', 'ghostiny', 'ghosty', 'mark'
];

/**
 * MyRoom：房间核心逻辑
 * - 管理房间状态（this.state）
 * - 处理客户端消息（move/puck/goal/event）
 * - 处理客户端的 join/leave 生命周期
 */
export class MyRoom extends Room {
  // 限制最多同时在线玩家数（2 人对战）
  maxClients = 2;

  // 初始房间状态实例（会同步给客户端）
  state = new MyRoomState();

  // 统计某个队伍当前有多少玩家（用于自动分队）
  teamPlayersCount(team: "left" | "right" = "left") {
    return [...this.state.players.values()].filter(p => p.team == team).length;
  }

  /**
   * messages：集中定义不同消息类型的处理函数，方便统一注册
   * - move: 客户端玩家位置更新
   * - puck: 冰球位置/碰撞信息
   * - goal: 进球处理与比分广播
   * - event: 通用事件转发
   */
  messages = {
    // 当客户端发送 `room.send("move", { x, y })` 时触发
    move: (client: Client, message: any) => {
      // 调试日志：打印收到的坐标
      console.log("received move from", client.sessionId, message);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        // 直接写入状态（会自动广播给所有客户端的订阅者）
        player.x = message.x;
        player.y = message.y;
      }
    },

    // 冰球相关消息（由物理或客户端同步）
    puck: (client: Client, message: any) => {
      if (message?.hit) this.state.lastHitBy = client.sessionId;
      this.state.puckX = message.x;
      this.state.puckY = message.y;
    },

    // 有玩家进球时调用，更新比分并广播
    goal: (client: Client, teamNet: "left" | "right") => {
      // 球进哪边网 -> 另一边得分
      const team = teamNet == "left" ? "right" : "left";
      this.state[`${team}Score`] += 1;

      // 格式化比分为等宽字符串（便于客户端显示）
      const pad = Math.max(this.state.leftScore, this.state.rightScore).toString().length;

      // 向所有客户端广播最新比分
      this.broadcast(
        "score",
        `${String(this.state.leftScore).padStart(pad, "0")}:${String(this.state.rightScore).padStart(pad, "0")}`
      );
    },

    // 通用事件转发：支持按 name 转发和排除发送者
    event: (client: Client, message: { name?: string; exceptLocal?: boolean; data?: any } = {}) => {
      const { name, exceptLocal, data } = message;
      const type = name ? `event:${name}` : "event";
      this.broadcast(type, data, exceptLocal ? { except: client } : undefined);
    },
  };

  // 当房间实例被创建时调用（一次）
  onCreate(options: any) {
    // 1. 设置更丰富的元数据，方便大厅玩家筛选
    this.setMetadata({
        roomName: options.roomName || "未命名房间",
        creator: options.creatorName || "匿名",
        level: options.level || "新手",
        // 标记是否为私有房间，如果是，在大厅列表查询时可以过滤掉
        isPrivate: options.isPrivate || false 
    });

    this.setState(new MyRoomState());

    // 初始化对战状态
    this.state.status = "waiting";

    // // 将 messages 中定义的每一个消息类型注册到 Colyseus 的消息系统
    // (Object.keys(this.messages) as Array<keyof typeof this.messages>).forEach((type) => {
    //   this.onMessage(type, (client, message) => {
    //     this.messages[type](client, message as any);
    //   });
    // });
    (Object.keys(this.messages) as Array<keyof typeof this.messages>).forEach((type) => {
      this.onMessage(type, (client, message) => {
        // 确保调用时上下文正确
        this.messages[type].call(this, client, message);
      });
    });
  }

  // 当有客户端加入房间时调用
  onJoin(client: Client, options: any) {
    console.log(client.sessionId, "joined!");

    // 创建新的 Player 状态并初始化位置、队伍、头像等
    const player = new Player();
    // 简单分队：交替分配 left / right
    player.team = this.teamPlayersCount() % 2 ? "right" : "left";
    player.x = player.team == "left" ? GAME_WIDTH / 4 : GAME_WIDTH - (GAME_WIDTH / 4);
    player.y = GAME_HEIGHT / 2;
    player.sessionId = client.sessionId;
    player.avatar = avatars[Math.floor(Math.random() * avatars.length)];

    // 将玩家添加到状态 Map（会触发客户端的 onAdd 回调）
    this.state.players.set(client.sessionId, player);

    // 如果是第一个玩家，初始化比分并广播；否则只把当前比分发给新加入者
    if (this.state.players.size === 1) {
      this.state.leftScore = 0;
      this.state.rightScore = 0;
      this.broadcast("score", "0:0");
    } else {
      const currentScore = `${this.state.leftScore}:${this.state.rightScore}`;
      client.send("score", currentScore);
    }


    // 2. 当有人加入时，实时更新元数据中的人数
    // 虽然 matchMaker 会追踪 clients，但在元数据中更新状态更直观
    if (this.state.players.size >= this.maxClients) {
      this.state.status = "playing";
      this.lock(); 
      
      // 更新元数据，告诉大厅：这个房间已经打起来了，别显示了
      this.setMetadata({ ...this.metadata, status: "playing" });
    }
  }

  // 当有客户端离开房间时调用
  onLeave(client: Client, code: number) {
    console.log(client.sessionId, "left!");

    // 从状态中删除玩家实例
    this.state.players.delete(client.sessionId);

    // 2. 逻辑改进：如果有人离开了，且当前人数少于最大人数，解锁房间
    // 这样大厅列表会重新显示这个房间，新玩家也可以通过 joinOrCreate 匹配进来补位
    if (this.state.players.size < this.maxClients) {
      this.state.status = "waiting"; // 将状态改回等待中
      this.unlock();                 // 核心：解锁房间
      console.log("有人退出，房间已解锁以供新玩家匹配");
    }

    // 若房间空了，可重置比分或执行其他清理逻辑
    if (this.state.players.size === 0) {
      this.state.leftScore = 0;
      this.state.rightScore = 0;
    }
  }

  // 房间销毁时调用（资源清理）
  onDispose() {
    console.log("room", this.roomId, "disposing...");
  }

}
