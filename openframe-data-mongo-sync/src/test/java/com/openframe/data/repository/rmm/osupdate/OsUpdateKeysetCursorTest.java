package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;

class OsUpdateKeysetCursorTest {

    private static final Instant INSTANT = Instant.parse("2026-11-20T09:14:02.481Z");
    private static final String KEY = "machine-1";
    private static final String CURSOR = INSTANT.toEpochMilli() + "|" + KEY;

    @Test
    void encode_instantAndKey_epochMillisThenTheKey() {
        // setup

        // execution
        String cursor = OsUpdateKeysetCursor.encode(INSTANT, KEY);

        // verifications
        assertThat(cursor).isEqualTo(CURSOR);
    }

    @Test
    void parse_encodedCursor_sameInstantAndKey() {
        // setup

        // execution
        OsUpdateKeysetCursor keysetCursor = OsUpdateKeysetCursor.parse(CURSOR);

        // verifications
        assertThat(keysetCursor)
                .extracting(OsUpdateKeysetCursor::getInstant, OsUpdateKeysetCursor::getKey)
                .containsExactly(INSTANT, KEY);
    }

    @Test
    void parse_keyWithTheSeparatorInside_keyIsEverythingAfterTheFirstSeparator() {
        // setup
        String cursor = INSTANT.toEpochMilli() + "|machine|1";

        // execution
        OsUpdateKeysetCursor keysetCursor = OsUpdateKeysetCursor.parse(cursor);

        // verifications
        assertThat(keysetCursor.getKey()).isEqualTo("machine|1");
    }

    @ParameterizedTest
    @CsvSource({
            "1795142470000,              no separator",
            "1795142470000|,             no key",
            "'1795142470000| ',          no key",
            "yesterday|machine-1,        Unparseable epoch millis",
            "|machine-1,                 Unparseable epoch millis"
    })
    void parse_cursorOfAnotherShape_throwsBadRequest(String cursor, String expectedMessage) {
        // setup

        // execution
        BadRequestException ex = assertThrows(BadRequestException.class, () -> OsUpdateKeysetCursor.parse(cursor));

        // verifications
        assertThat(ex.getMessage()).contains(expectedMessage);
    }
}
