/**
 * "What to ask?" is a slash command, `/what-can-you-do`: the server answers it as a turn (a line of text and a
 * `data-suggestions` part: every quick action of the chat, by group), stored in the chat's history like any other. The
 * chat's entry sends it, the server registers it under this id and lists it in the command catalog, whose label the
 * entry shows. One id, here, for both sides.
 */
export const WHAT_CAN_YOU_DO_COMMAND = 'what-can-you-do';

/** The message the chat's "What to ask?" entry sends. */
export const WHAT_CAN_YOU_DO_MESSAGE = `/${WHAT_CAN_YOU_DO_COMMAND}`;
