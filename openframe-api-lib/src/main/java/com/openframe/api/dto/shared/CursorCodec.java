package com.openframe.api.dto.shared;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Utility for encoding and decoding opaque Relay-style pagination cursors.
 * Cursors are base64-encoded strings that hide internal implementation details
 * (e.g., MongoDB ObjectIds, composite keys) from API consumers.
 */
public final class CursorCodec {

    private CursorCodec() {
    }

    /**
     * Encodes a raw cursor value into an opaque base64 string.
     *
     * @param rawCursor the internal cursor value (e.g., ObjectId, "timestamp_eventId")
     * @return base64-encoded opaque cursor, or null if input is null/empty
     */
    public static String encode(String rawCursor) {
        if (rawCursor == null || rawCursor.isEmpty()) {
            return null;
        }
        return Base64.getEncoder().encodeToString(rawCursor.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * Decodes an opaque base64 cursor back to the raw internal value.
     *
     * @param opaqueCursor the base64-encoded cursor from the client
     * @return decoded raw cursor value, or null if input is null/empty/invalid
     */
    public static String decode(String opaqueCursor) {
        if (opaqueCursor == null || opaqueCursor.trim().isEmpty()) {
            return null;
        }
        try {
            return new String(Base64.getDecoder().decode(opaqueCursor), StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
