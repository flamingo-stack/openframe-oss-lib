package com.openframe.external.util;

import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.core.exception.BadRequestException;
import com.openframe.core.exception.ErrorCode;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.http.HttpStatus;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ExternalCursorsTest {

    private static final String TICKET_ID = "65f1a2b3c4d5e6f708192a3b";

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t\n"})
    void absentBase64CursorMeansFirstPage(String cursor) {
        assertNull(ExternalCursors.decodeBase64(cursor));
    }

    @Test
    void validBase64CursorIsDecoded() {
        assertEquals("1700000000000_event-1", ExternalCursors.decodeBase64("MTcwMDAwMDAwMDAwMF9ldmVudC0x"));
    }

    @Test
    void cursorsIssuedByTheCodecRoundTrip() {
        String raw = "2024-01-02T03:04:05.678Z_ticket/1?x=y";

        assertEquals(raw, ExternalCursors.decodeBase64(CursorCodec.encode(raw)));
    }

    @Test
    void unpaddedBase64IsAccepted() {
        assertEquals("ab", ExternalCursors.decodeBase64("YWI"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not base64!!", "abc$", "a-b_", "Y", " YWJj", "YWJj ", "YWJj=", "YW=Jj"})
    void undecodableCursorIsBadRequestNotFirstPage(String cursor) {
        BadRequestException ex = assertThrows(BadRequestException.class, () -> ExternalCursors.decodeBase64(cursor));

        assertEquals("Invalid cursor: " + cursor, ex.getMessage());
        assertEquals(ErrorCode.BAD_REQUEST, ex.getErrorCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }

    @Test
    void wellFormedBase64OfArbitraryBytesIsNotRejectedHere() {
        String cursor = Base64.getEncoder().encodeToString(new byte[]{(byte) 0xFF, (byte) 0xFE, 0x00, 0x01});

        String decoded = ExternalCursors.decodeBase64(cursor);

        assertNotNull(decoded);
        assertEquals(new String(new byte[]{(byte) 0xFF, (byte) 0xFE, 0x00, 0x01}, StandardCharsets.UTF_8), decoded);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {" ", "   ", "\t\n"})
    void absentTicketCursorMeansFirstPage(String cursor) {
        assertNull(ExternalCursors.requireTicketCursor(cursor));
    }

    @Test
    void objectIdTicketCursorIsReturnedUnchanged() {
        assertSame(TICKET_ID, ExternalCursors.requireTicketCursor(TICKET_ID));
    }

    @Test
    void upperCaseObjectIdIsAccepted() {
        String upper = TICKET_ID.toUpperCase();

        assertEquals(upper, ExternalCursors.requireTicketCursor(upper));
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "123",
            "not-an-object-id",
            "65f1a2b3c4d5e6f708192a3",
            "65f1a2b3c4d5e6f708192a3b0",
            "65f1a2b3c4d5e6f708192a3g",
            " 65f1a2b3c4d5e6f708192a3b",
            "65f1a2b3c4d5e6f708192a3b ",
            "NjVmMWEyYjNjNGQ1ZTZmNzA4MTkyYTNi"
    })
    void nonObjectIdTicketCursorIsBadRequestNotFirstPage(String cursor) {
        BadRequestException ex = assertThrows(BadRequestException.class, () -> ExternalCursors.requireTicketCursor(cursor));

        assertEquals("Invalid cursor: " + cursor, ex.getMessage());
        assertEquals(ErrorCode.BAD_REQUEST, ex.getErrorCode());
        assertEquals(HttpStatus.BAD_REQUEST, ex.getHttpStatus());
    }
}
