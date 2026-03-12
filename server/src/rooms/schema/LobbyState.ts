// server/src/rooms/schema/LobbyState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";

export class LobbyPlayer extends Schema {
    @type("string") name: string;
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("string") avatar: string;
}

export class ChatMessage extends Schema {
    @type("string") sender: string;
    @type("string") content: string;
}

export class LobbyState extends Schema {
    @type({ map: LobbyPlayer }) players = new MapSchema<LobbyPlayer>();
    // 用于存放最近的聊天记录
    @type({ map: ChatMessage }) messages = new MapSchema<ChatMessage>();
}