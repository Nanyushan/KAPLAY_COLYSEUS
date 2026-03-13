import type { GameObj } from "kaplay";
import { k } from "../App";
import { Room } from "@colyseus/sdk";
import type { MyRoomState } from "../../../server/src/rooms/schema/MyRoomState";

// 接收 room 实例，以便读取元数据中的障碍物信息
export default (room: Room<MyRoomState>) => [
    k.pos(),
    k.z(0),
    {
        add(this: GameObj) {
            const thickness = 500;
            const bleed = 5;

            // 1. 场景边界绘制 (保持原有逻辑)
            this.boundaries = [
                { x: -thickness, y: -thickness, w: k.width() + thickness * 2, h: thickness + bleed },
                { x: -thickness, y: k.height() - bleed, w: k.width() + thickness * 2, h: thickness + bleed },
                { x: -thickness, y: -thickness, w: thickness + bleed, h: k.height() + thickness * 2 },
                { x: k.width() - bleed, y: -thickness, w: thickness + bleed, h: k.height() + thickness * 2 },
            ].map(({ x, y, w, h }) => {
                this.add([
                    k.pos(x, y),
                    k.rect(w, h, { fill: false }),
                    k.area({ collisionIgnore: ["boundary"] }),
                    k.body({ isStatic: true }),
                    "boundary",
                ]);
            });

            // 2. 绘制场地 (保持原有逻辑)
            const field = this.add([
                k.anchor("center"),
                k.pos(k.center()),
                k.rect(k.width() - 20, k.height() - 20, { radius: 100 }),
                k.outline(10, k.WHITE),
                k.opacity(0.4),
            ]);

            const nets = [-1, 1].map(side =>
                field.add([
                    k.anchor("center"),
                    k.pos(field.width / 2 * side, 0),
                    k.rect(8, 200, { radius: side == -1 ? [0, 2, 2, 0] : [2, 0, 0, 2] }),
                    k.color(k.Color.fromHex("834dc4")),
                    k.outline(4, k.Color.fromHex("1f102a")),
                    k.area({ collisionIgnore: ["boundary", "player"] }),
                    "net",
                    { team: side == -1 ? "left" : "right" },
                ])
            );



            // 3. 场地装饰绘制 (保持原有逻辑)
            field.onDraw(() => {
                k.drawMasked(() => {
                    // ... (中间的圆圈、线条绘制逻辑保持不变)
                    k.drawCircle({ radius: 114, color: k.Color.fromHex("c9ddff") });
                    k.drawRect({ anchor: "center", height: field.height - 5, width: 20, color: k.Color.fromHex("adb2f0"), outline: { width: 4, color: k.Color.fromHex("c9ddff") } });
                    k.drawCircle({ radius: 100, color: k.Color.fromHex("bbd4ff"), outline: { width: 20, color: k.Color.fromHex("adb2f0") } });
                    k.drawCircle({ radius: 16, color: k.Color.fromHex("834dc4"), outline: { width: 4, color: k.Color.fromHex("d6e5ff") } });

                    nets.forEach(net => {
                        k.drawCircle({ anchor: "center", pos: net.pos, radius: net.height / 2, color: k.Color.fromHex("adb2f0"), outline: { width: 4, color: k.Color.fromHex("c9ddff") } });
                    });

                    [[-450, 20], [-400, 60], [0, 60], [50, 20]].forEach(([x, w]) =>
                        k.drawLine({ p1: k.vec2(x + 400, -field.height), p2: k.vec2(x, field.height), width: w, opacity: 0.2 })
                    );
                }, () => {
                    k.drawRect({ anchor: "center", width: field.width - 10, height: field.height - 10, radius: +(field?.radius ?? 100) - 10 });
                });
            });
        },
    },
];