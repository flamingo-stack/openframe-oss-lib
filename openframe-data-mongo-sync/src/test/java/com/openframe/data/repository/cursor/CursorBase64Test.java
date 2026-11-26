package com.openframe.data.repository.cursor;

import com.openframe.core.exception.InvalidCursorException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

class CursorBase64Test {

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void decode_nullOrBlank_null(String opaqueCursor) {
        // execution
        String decoded = CursorBase64.decode(opaqueCursor);

        // verifications
        assertThat(decoded).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "fn5+fn5+Pz8/Pz8/, ~~~~~~??????",
            "fn5-fn5-Pz8_Pz8_, ~~~~~~??????",
            "fn5+Pw==, ~~~?",
            "fn5-Pw==, ~~~?",
            "fn5+Pw, ~~~?",
            "fn5-Pw, ~~~?",
            "fn5+Pz8=, ~~~??",
            "fn5-Pz8, ~~~??"
    })
    void decode_standardOrUrlSafeAlphabetWithOrWithoutPadding_text(String opaqueCursor, String expected) {
        // execution
        String decoded = CursorBase64.decode(opaqueCursor);

        // verifications
        assertThat(decoded).isEqualTo(expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {"not base64 at all!", "%%%%", "a", "k1|name|ASC|5|id"})
    void decode_notBase64_throwsInvalidCursor(String opaqueCursor) {
        // execution
        Throwable thrown = catchThrowable(() -> CursorBase64.decode(opaqueCursor));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage("Invalid cursor");
    }
}
