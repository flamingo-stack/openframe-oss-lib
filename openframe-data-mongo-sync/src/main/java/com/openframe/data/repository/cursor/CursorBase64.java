package com.openframe.data.repository.cursor;

import com.openframe.core.exception.InvalidCursorException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

public final class CursorBase64 {

    private CursorBase64() {
    }

    public static String decode(String opaqueCursor) {
        if (opaqueCursor == null || opaqueCursor.isBlank()) {
            return null;
        }
        String standardAlphabet = opaqueCursor.replace('-', '+').replace('_', '/');
        try {
            byte[] decoded = Base64.getDecoder().decode(standardAlphabet);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
    }
}
