/** The widths the chat lays itself out by. A leaf: a host reads them without loading the chat. */

/** The v2 chat list (`MingoChatRail`, Figma `chat-sidebar`): the narrowest the v2 chat draws. */
export const MINGO_V2_RAIL_WIDTH = 296;

/** The narrowest the conversation itself draws. */
export const CHAT_BLOCK_MIN_WIDTH = 400;

/** Mingo v2: the list and the chat side by side at their narrowest. */
export const MINGO_V2_SPLIT_WIDTH = MINGO_V2_RAIL_WIDTH + CHAT_BLOCK_MIN_WIDTH;
