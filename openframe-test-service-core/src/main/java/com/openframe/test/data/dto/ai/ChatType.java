package com.openframe.test.data.dto.ai;

/**
 * Per-message chat channel. Mirrors {@code com.openframe.data.document.chat.ChatType} in the AI agent
 * service. Device-targeting technician flows use {@link #ADMIN_AI_CHAT}.
 */
public enum ChatType {
    CLIENT_CHAT,
    ADMIN_AI_CHAT
}
