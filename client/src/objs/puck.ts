import { getStateCallbacks, Room } from "@colyseus/sdk";
import type { Collision, DrawRectOpt, GameObj } from "kaplay";
import type { MyRoomState } from "../../../server/src/rooms/schema/MyRoomState";
import { k } from "../App";

// puck 大小（用于绘制与碰撞半径计算）
const size = 48;

// 初始位置：画布中心略微向上偏移 6 像素
const startPos = () => (k.center().sub(0, 6));

// 导出一个工厂函数，返回 kaplay 的组件数组，表示冰球对象
export default (room: Room<MyRoomState>) => [
    // 位置、锚点、碰撞形状等基础组件
    k.pos(startPos()),
    k.anchor("center"),
    k.area({
        shape: new k.Circle(k.vec2(0), size / 2),
        restitution: 0.2, // 弹性系数：碰撞后的反弹程度
    }),
    k.body(),
    k.scale(0), // 初始缩放为 0，稍后播放入场动画
    k.z((k.height() - size) / 2), // 初始 Z（用于层级）基于 Y
    "puck",
    {
        // add 生命周期：对象被加入场景时的初始化逻辑
        add(this: GameObj) {
            // 获取用于监听房间状态变化的辅助 $ 函数
            const $ = getStateCallbacks(room);
            // 本客户端的 sessionId（用于判定是否为 authority/最后击球者）
            const localPlayerId = room.sessionId;

            // 缩放入场动画：如果房间内已经存在 puck 的位置（mid-game），延迟播放
            // 注：原始代码中 `room.state.puckX || room.state.puckX` 看起来重复，
            // 但意图是基于是否已有状态来延迟动画，这里只是保留原行为
            k.wait(
                room.state.puckX || room.state.puckX ? 1.25 : 0,
                () =>
                    k.tween(
                        this.scale,
                        k.vec2(1),
                        0.25,
                        v => this.scale = v,
                        k.easings.easeOutBack,
                    ),
            );

            // 碰撞：本地玩家与冰球碰撞的处理
            // - 把冰球当前位置发送到服务器（并标记 hit: true 表示本次为击打事件）
            // - 将速度置零，并根据碰撞法线施加冲量
            // - 播放命中音效，同时注册监听以在其他客户端播放反馈
            this.onCollide("localPlayer", (_: GameObj, col: Collision) => {
                // 发送 puck 消息到服务器，告诉服务器当前冰球位置和 hit 标记
                room.send("puck", { ...this.pos, hit: true });
                // 停止当前速度，防止连续累积
                this.vel = k.vec2(0);
                // 根据碰撞向量施加冲量（用于本地视觉上的反弹）
                this.applyImpulse(col.normal.scale(col.distance).scale(100));
                k.play("hit");

                // 监听服务器转发的 hit 事件以播放额外反馈（示例）
                room.onMessage("event:hit", async (target) => {
                    k.play("hit");
                    if (target == "boundary") k.shake(2);
                });
            });

            // 其他玩家碰撞冰球（非本地玩家）
            this.onCollide("player", (obj: GameObj) => {
                // 如果碰撞到的是本地玩家则忽略（已由上面的 handler 处理）
                if (obj.is("localPlayer")) return;

                // 告诉服务器发生了 hit 事件（不包含具体位置）
                room.send("event", { name: "hit" });
            });

            // 碰到边界（场地边缘）的处理：只有当本地玩家是最后击球者时才触发反馈
            this.onCollide("boundary", () => {
                if (room.state.lastHitBy != localPlayerId) return;

                k.shake(2);
                k.play("hit");
                // 告诉其他客户端发生了 boundary hit（exceptLocal 防止本地重复播放）
                room.send("event", { name: "hit", exceptLocal: true, data: "boundary" });
            });

            // 监听服务器状态中 lastHitBy 的变化：当另一端成为 lastHitBy 时，将本地冰球速度重置
            // 解释：当其他玩家击打并成为权威（lastHitBy），本地只会通过 state 的 puckX/puckY 来插值位置，
            // 因此需要确保本地速度为 0 避免物理叠加造成表现异常
            $(room.state).listen("lastHitBy", (id) => {
                if (id == localPlayerId) return;
                this.vel = k.vec2(0);
            });

            // 碰到球门（net）时的处理：如果本地是最后击球者，则通知服务器得分并重置冰球
            this.onCollide("net", async (net: GameObj) => {
                // 只有最后击球的客户端负责通知服务器（避免重复通知）
                if (room.state.lastHitBy != localPlayerId) return;

                // 通知服务器发生进球（服务器会更新比分并广播 score）
                room.send("goal", net.team);
                // 临时把冰球重置到起始位置并通知服务器（服务器/客户端会按 score 流程重置）
                room.send("puck", startPos());

                // 等待服务器广播最新比分（通过 room.onMessage("score") 回调）
                room.onMessage("score", async (score) => {
                    // 重置物理状态并临时忽略玩家碰撞，以便做重置动画
                    this.vel = k.vec2(0);
                    this.collisionIgnore.push("player");

                    // 如果不是 0:0，播放一些特效（示例）
                    if (score != "0:0") {
                        k.addKaboom(k.vec2(k.clamp(100, room.state.puckX, k.width() - 100), room.state.puckY), { scale: 0.8 });
                        k.shake(10);
                        k.flash(k.getBackground() ?? k.WHITE, 0.25);
                        k.burp();
                    }

                    // 缩出冰球，间隔后再放回起始位置并缩回
                    await k.tween(
                        this.scale,
                        k.vec2(0),
                        0.25,
                        v => this.scale = v,
                        k.easings.easeOutQuad,
                    );
                    room.send("puck", startPos());
                    this.pos = startPos();

                    // 在下一轮开始时恢复与玩家的碰撞并播放缩入动画
                    k.wait(1, () => {
                        this.collisionIgnore = this.collisionIgnore.filter((c: string) =>
                            c != "player"
                        );
                        k.tween(
                            this.scale,
                            k.vec2(1),
                            0.25,
                            v => this.scale = v,
                            k.easings.easeOutQuad,
                        );
                    });
                });

            });

            // 每帧更新：根据谁是 authority（lastHitBy）来决定本地如何更新冰球位置
            // - 如果本地为权威（localPlayerId === lastHitBy），则向服务器上报当前位置
            // - 否则，使用服务器 state 中的 puckX/puckY 做插值以平滑同步
            this.onUpdate(() => {
                // 当前客户端为权威：发送实时位置到服务器
                if (localPlayerId == (room.state?.lastHitBy ?? localPlayerId)) {
                    room.send("puck", this.pos);
                }
                // 非权威：从服务器状态 lerp 到同步位置
                else {
                    this.pos.x = k.lerp(
                        this.pos.x,
                        room.state.puckX,
                        12 * k.dt(),
                    );
                    this.pos.y = k.lerp(
                        this.pos.y,
                        room.state.puckY,
                        12 * k.dt(),
                    );
                }

                // 根据 Y 值动态更新 Z 顺序
                this.z = this.pos.y;
            });
        },

        // draw 生命周期：自定义绘制冰球外观的代码
        draw() {
            const side: DrawRectOpt = {
                pos: k.vec2(0, size / 4),
                anchor: "center",
                width: size,
                height: size * 0.75,
                color: k.Color.fromHex("4a3052"),
                outline: {
                    width: 4,
                    color: k.Color.fromHex("1f102a"),
                },
                radius: [8, 8, size, size],
            };

            // 绘制一些底层的光影与主体形状
            k.drawRect({ ...side, pos: side.pos?.scale(2), opacity: 0.2 });
            k.drawRect(side);

            k.drawEllipse({
                anchor: "center",
                radiusX: size / 2,
                radiusY: size / 2 - 4,
                color: k.Color.fromHex("7b5480"),
                outline: {
                    width: 4,
                    color: k.Color.fromHex("1f102a"),
                },
            });
        },
    },
];