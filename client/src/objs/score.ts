import { Room } from "@colyseus/sdk";
import type { GameObj } from "kaplay";
import type { MyRoomState } from "../../../server/src/rooms/schema/MyRoomState";
import { k } from "../App";

export default (room: Room<MyRoomState>) => [
    {
        textWidth: 24 * 3,
        draw() {
            k.drawRect({
                anchor: "top",
                pos: k.vec2(0, -6),
                width: this.textWidth + 30,
                height: 54,
                radius: [0, 0, 16, 16],
                color: k.Color.fromHex("1f102a"),
                opacity: 0.8,
            });
        },
    },
    k.anchor("top"),
    k.pos(k.width() / 2, 6),
    k.fixed(),
    k.z(9999),
    k.text(`${room.state.leftScore ?? 0}:${room.state.rightScore ?? 0}`),
    k.animate(),
    {
        add(this: GameObj) {
            this.textWidth = this.width;

            room.onMessage("score", (score) => {
                this.text = score;
                this.textWidth = this.width;

                this.animation.seek(0);
                this.animate("scale", [
                    k.vec2(1),
                    k.vec2(0.75, 1.05),
                    k.vec2(1.2),
                    k.vec2(1),
                ], {
                    duration: 0.2,
                    loops: 1,
                });
            });
        },
    },
];