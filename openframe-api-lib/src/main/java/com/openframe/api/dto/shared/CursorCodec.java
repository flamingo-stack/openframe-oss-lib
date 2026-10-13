package com.openframe.api.dto.shared;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

// Utility for encoding and decoding opaque Relay-style pagination cursors, hiding internal keys from API consumers.
public final class CursorCodec {

    private CursorCodec() {
    }

    // Encodes a raw cursor value (e.g., ObjectId, "timestamp_eventId") into an opaque base64 string.
    public static String encode(String rawCursor) {
        if (rawCursor == null || rawCursor.isEmpty()) {
            return null;
        }
        return Base64.getEncoder().encodeToString(rawCursor.getBytes(StandardCharsets.UTF_8));
    }

    // Decodes an opaque base64 cursor back to the raw internal value, returning null if invalid.
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
