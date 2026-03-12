// 定义同步到客户端的状态模型（使用 Colyseus 的 Schema 系统）
import { Schema, MapSchema, type } from '@colyseus/schema';

// Player：表示房间内的单个玩家，这些字段会被序列化并推送到客户端
export class Player extends Schema {
    // 唯一会话 ID（由 Colyseus 分配），同样可作为 Map 的 key
    @type('string') public sessionId: string;
    // 业务上的用户 ID（可选），例如数据库中的用户标识
    @type('string') public userId: string;
    // 头像名称或资源标识，用于客户端加载 sprite
    @type('string') public avatar: string;
    // 玩家昵称
    @type('string') public name: string;

    // 玩家在世界坐标系中的位置（会被客户端用于渲染）
    @type('number') public x: number = 0;
    @type('number') public y: number = 0;

    // 玩家所属队伍：'left' 或 'right'
    @type('string')
    public team: 'left' | 'right' = 'left';
}

// MyRoomState：房间的根状态对象，客户端通过 `room.state` 访问这个实例
export class MyRoomState extends Schema {
    // players：使用 MapSchema 存储房间内所有玩家（key 通常为 sessionId）
    // MapSchema 的增删改会被自动推送到客户端，客户端可监听 onAdd/onRemove/onChange
    @type({ map: Player }) players = new MapSchema<Player>();

    // 增加房间状态：'waiting' (等待匹配), 'playing' (已开始), 'finished' (已结束)
    @type("string") public status: string = "waiting";

    // 冰球（Puck）的坐标（如果游戏中有物理或同步冰球位置）
    @type('number') public puckX: number;
    @type('number') public puckY: number;

    // 记录最近一次击球的玩家（用于判定得分归属或触发特效）
    @type('string') public lastHitBy: string;

    // 比分（左右队伍）
    @type('number') public leftScore: number = 0;
    @type('number') public rightScore: number = 0;
}


