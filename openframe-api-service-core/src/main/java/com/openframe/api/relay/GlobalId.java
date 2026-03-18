package com.openframe.api.relay;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Utility for encoding and decoding Relay-style global IDs.
 * Format: base64("TypeName:rawId")
 */
public record GlobalId(String typeName, String rawId) {

    public String encode() {
        return Base64.getEncoder().encodeToString(
                (typeName + ":" + rawId).getBytes(StandardCharsets.UTF_8));
    }

    public static GlobalId decode(String encodedId) {
        String decoded = new String(Base64.getDecoder().decode(encodedId), StandardCharsets.UTF_8);
        int colonIndex = decoded.indexOf(':');
        if (colonIndex < 0) {
            throw new IllegalArgumentException("Invalid global ID format: " + encodedId);
        }
        return new GlobalId(
                decoded.substring(0, colonIndex),
                decoded.substring(colonIndex + 1));
    }

    public static String toGlobalId(String typeName, String rawId) {
        return new GlobalId(typeName, rawId).encode();
    }
}
