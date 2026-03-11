import type { GameObj, Vec2 } from "kaplay";
import type { MyRoomState, Player } from "../../../server/src/rooms/schema/MyRoomState";
import { k } from "../App";
import { Room } from "@colyseus/sdk";

// Needs room state and player instance for server communication and player data
export default (room: Room<MyRoomState>, player: Player) => ([
    k.sprite(player.avatar, { flipX: player.team == "right" }), // player on the right side will face center
    k.pos(player.x, player.y), // initial pos by server
    k.anchor("center"),
    k.area({ shape: new k.Circle(k.vec2(0), (k.getSprite(player.avatar)?.data?.width ?? 32) * 0.4) }), // smaller area than sprite to not collide with transparent parts
    k.body({ isStatic: true }), // won't be affected/moved when hit
    k.scale(0), // we will scale-in player on spawn
    k.z(player.y), // update Z sorting as well by matching it to Y
    "player",
    {
        // Define a bunch of useful properties
        sessionId: player.sessionId,
        team: player.team,
        startPos: k.vec2(player.x, player.y),
        moveLerp: 12, // for position interpolation
        overshootLerp: 30, // for fast movement interpolation
        controllable: true, // e.g. disable when resetting player on goal
        add(this: GameObj) {
            // Scale player in with nice transition once added
            k.tween(this.scale, k.vec2(1), 0.25, v => this.scale = v, k.easings.easeOutBack);

            // Raytracing :)
            this.add([
                k.anchor("center"),
                k.sprite(player.avatar, { flipX: this.flipX, flipY: true }),
                k.pos(0, k.getSprite(player.avatar)?.data?.height ?? this.height),
                k.opacity(0.2),
            ]);

            const moveOffset = {
                x: this.width / 2,
                y: this.height / 2,
                overshoot: 10,
            };

            this.moveMinMax = {
                x: Object.values(player.team == "left" ? {
                    min: moveOffset.x,
                    max: k.width() / 2 - moveOffset.x + moveOffset.overshoot,
                } : {
                    min: k.width() / 2 + moveOffset.x - moveOffset.overshoot,
                    max: k.width() - moveOffset.x,
                }),
                y: Object.values({
                    min: moveOffset.y,
                    max: k.height() - moveOffset.y,
                })
            };

            if (player.sessionId == room.sessionId) onLocalPlayerCreated(room, this);
        },
        update(this: GameObj) {
            this.pos.x = k.lerp(
                this.pos.x,
                player.x,
                k.dt() * (this.moveMinMax.x.includes(player.x) ? this.overshootLerp : this.moveLerp)
            );
            this.pos.y = this.z = k.lerp(
                this.pos.y,
                player.y,
                k.dt() * (this.moveMinMax.y.includes(player.y) ? this.overshootLerp : this.moveLerp)
            );
        },
    },
]);

function onLocalPlayerCreated(room: Room<MyRoomState>, playerObj: GameObj) {
    // differentiate local player with tag
    playerObj.tag("localPlayer");

    // save mouse pos locally
    let mousePos = playerObj.startPos;
    let touchPos = playerObj.startPos;
    const [moveMinX, moveMaxX] = playerObj.moveMinMax.x;
    const [moveMinY, moveMaxY] = playerObj.moveMinMax.y;

    room.onMessage("score", () => {
        mousePos = playerObj.startPos;
        playerObj.controllable = false;
        room.send("move", mousePos);

        k.wait(1.25, () => playerObj.controllable = true);
    });

    const move = (_: Vec2, delta: Vec2, isMouse = true) => {
        if ((isMouse && !k.isCursorLocked()) || !playerObj.controllable) return;

        const { x, y } = mousePos;
        const newX = x + delta.x;
        const newY = y + delta.y;

        mousePos = k.vec2(
            k.clamp(moveMinX, newX, moveMaxX),
            k.clamp(moveMinY, newY, moveMaxY),
        );

        console.log("Sending move to server:", mousePos); // 添加这一行
        room.send("move", mousePos);
    };

    k.onMouseMove(move);
    k.onTouchStart(pos => {
        touchPos = pos;
        // also update mousePos for consistency on touchstart
        mousePos = pos;
    });
    k.onTouchMove((pos) => {
        move(pos, pos.sub(touchPos).scale(window.devicePixelRatio), false);
        touchPos = pos;
    });

    // 支持点击移动（点击画布将角色移动到该位置）
    k.onClick(() => {
        if (!playerObj.controllable) return;

        const pos = k.mousePos ? k.mousePos() : playerObj.pos;

        mousePos = k.vec2(
            k.clamp(moveMinX, pos.x, moveMaxX),
            k.clamp(moveMinY, pos.y, moveMaxY),
        );

        console.log("Sending click move to server:", mousePos);
        room.send("move", mousePos);
    });

}