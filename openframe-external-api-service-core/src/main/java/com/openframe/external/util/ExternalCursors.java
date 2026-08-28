package com.openframe.external.util;

import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.core.exception.BadRequestException;
import org.bson.types.ObjectId;

/**
 * Cursor validation for the external API: a corrupted cursor must fail loudly with 400 instead of
 * silently answering with page one (a client restarting its pagination forever would never notice).
 */
public final class ExternalCursors {

    private ExternalCursors() {
    }

    /** Decodes an opaque base64 cursor; null/blank means "first page", anything undecodable is a 400. */
    public static String decodeBase64(String cursor) {
        if (cursor == null || cursor.trim().isEmpty()) {
            return null;
        }
        String decoded = CursorCodec.decode(cursor);
        if (decoded == null) {
            throw new BadRequestException("Invalid cursor: " + cursor);
        }
        return decoded;
    }

    /** Ticket cursors are raw ticket ids (ObjectId hex); anything else is a 400. */
    public static String requireTicketCursor(String cursor) {
        if (cursor == null || cursor.trim().isEmpty()) {
            return null;
        }
        if (!ObjectId.isValid(cursor)) {
            throw new BadRequestException("Invalid cursor: " + cursor);
        }
        return cursor;
    }
}
