package com.openframe.data.repository.cursor;

import com.openframe.core.exception.InvalidCursorException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.data.domain.Sort;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.junit.jupiter.params.provider.Arguments.arguments;

class KeysetCursorTest {

    private static final String ROW_ID = "65f1a2b3c4d5e6f708192a3b";
    private static final String CREATED_AT = "createdAt";
    private static final String NAME = "name";
    private static final long CREATED_AT_MILLIS = 1_700_000_000_123L;
    private static final Instant CREATED_AT_VALUE = Instant.ofEpochMilli(CREATED_AT_MILLIS);
    private static final String NAME_WITH_SEPARATOR = "Acme|Corp";
    private static final String ID_ENCODED_WITH_PLUS_AND_SLASH = "evt-~~~~~~??????";
    private static final String INVALID_CURSOR = "Invalid cursor";

    @Test
    void encode_instantValue_standardBase64OfVersionSortFieldDirectionMillisAndId() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, CREATED_AT_VALUE, ROW_ID);
        String expected = standardBase64("k1|createdAt|DESC|1700000000123|" + ROW_ID);

        // execution
        String encoded = cursor.encode();

        // verifications
        assertThat(encoded).isEqualTo(expected);
    }

    @Test
    void encode_stringValue_valueWrittenAsBase64() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, NAME_WITH_SEPARATOR, ROW_ID);
        String expected = standardBase64("k1|name|ASC|" + standardBase64(NAME_WITH_SEPARATOR) + "|" + ROW_ID);

        // execution
        String encoded = cursor.encode();

        // verifications
        assertThat(encoded).isEqualTo(expected);
    }

    @Test
    void encode_nullInstant_emptyValuePart() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.ASC, null, ROW_ID);
        String expected = standardBase64("k1|createdAt|ASC||" + ROW_ID);

        // execution
        String encoded = cursor.encode();

        // verifications
        assertThat(encoded).isEqualTo(expected);
    }

    @Test
    void encode_nullString_emptyValuePart() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.DESC, null, ROW_ID);
        String expected = standardBase64("k1|name|DESC||" + ROW_ID);

        // execution
        String encoded = cursor.encode();

        // verifications
        assertThat(encoded).isEqualTo(expected);
    }

    @Test
    void new_nullRawValue_storedAsTheEmptyValue() {
        // execution
        KeysetCursor cursor = new KeysetCursor(NAME, Sort.Direction.ASC, null, ROW_ID);

        // verifications
        assertThat(cursor.rawValue()).isEmpty();
        assertThat(cursor.hasNullValue()).isTrue();
    }

    @ParameterizedTest
    @CsvSource({
            "na|me, 5",
            "name, 2|7"
    })
    void new_separatorInSortFieldOrRawValue_throwsIllegalArgument(String sortField, String rawValue) {
        // execution
        Throwable thrown = catchThrowable(
                () -> new KeysetCursor(sortField, Sort.Direction.ASC, rawValue, ROW_ID));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("A keyset cursor part cannot contain |");
    }

    @ParameterizedTest
    @MethodSource("incompleteCursors")
    void new_sortFieldDirectionOrIdMissing_throwsIllegalArgument(String sortField, Sort.Direction direction,
                                                                 String id) {
        // execution
        Throwable thrown = catchThrowable(
                () -> new KeysetCursor(sortField, direction, "5", id));

        // verifications
        assertThat(thrown)
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("A keyset cursor needs a sort field, a direction and an id");
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", "   "})
    void parse_nullOrBlank_noPosition(String rawInput) {
        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(new CursorPosition.None());
    }

    @Test
    void parse_rawObjectId_rowIdWithoutDecodingIt() {
        // execution
        CursorPosition position = KeysetCursor.parse(ROW_ID);

        // verifications
        assertThat(position).isEqualTo(new CursorPosition.RowId(ROW_ID));
    }

    @Test
    void parse_base64OfAnObjectId_rowId() {
        // setup
        String rawInput = standardBase64(ROW_ID);

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(new CursorPosition.RowId(ROW_ID));
    }

    @Test
    void parse_encodedInstantCursor_keysetPositionWithItsInstant() {
        // setup
        String rawInput = KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, CREATED_AT_VALUE, ROW_ID).encode();
        KeysetCursor expected = new KeysetCursor(CREATED_AT, Sort.Direction.DESC, "1700000000123", ROW_ID);

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(expected);
        assertThat(expected.instantValue()).isEqualTo(CREATED_AT_VALUE);
        assertThat(expected.hasNullValue()).isFalse();
    }

    @Test
    void parse_encodedStringCursorWithASeparatorInTheValue_keysetPositionWithTheSameString() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, NAME_WITH_SEPARATOR, ROW_ID);
        String rawInput = cursor.encode();

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(cursor);
        assertThat(cursor.stringValue()).isEqualTo(NAME_WITH_SEPARATOR);
        assertThat(cursor.sortField()).isEqualTo(NAME);
        assertThat(cursor.direction()).isEqualTo(Sort.Direction.ASC);
        assertThat(cursor.id()).isEqualTo(ROW_ID);
    }

    @Test
    void parse_encodedNullValueCursor_keysetPositionWithANullValue() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, null, ROW_ID);
        String rawInput = cursor.encode();

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(cursor);
        assertThat(cursor.hasNullValue()).isTrue();
        assertThat(cursor.stringValue()).isNull();
        assertThat(cursor.instantValue()).isNull();
    }

    @Test
    void parse_encodedEmptyStringCursor_keysetPositionWithAnEmptyStringNotANull() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, "", ROW_ID);
        String rawInput = cursor.encode();

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(cursor);
        assertThat(cursor.hasNullValue()).isFalse();
        assertThat(cursor.stringValue()).isEmpty();
    }

    @Test
    void parse_idWithASeparatorInside_idKeptWhole() {
        // setup
        String rawInput = standardBase64("k1|eventTimestamp|DESC|1700000000123|evt|7");
        KeysetCursor expected = new KeysetCursor("eventTimestamp", Sort.Direction.DESC, "1700000000123", "evt|7");

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(expected);
    }

    @ParameterizedTest
    @MethodSource("sameCursorInEachAlphabet")
    void parse_standardOrUrlSafeAlphabet_sameKeysetPosition(String rawInput) {
        // setup
        KeysetCursor expected = new KeysetCursor(
                "eventTimestamp", Sort.Direction.DESC, "1700000000123", ID_ENCODED_WITH_PLUS_AND_SLASH);

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(expected);
    }

    @Test
    void parse_base64OfAnotherFormat_unrecognisedWithTheDecodedText() {
        // setup
        String rawInput = standardBase64("1700000000123_evt-7");

        // execution
        CursorPosition position = KeysetCursor.parse(rawInput);

        // verifications
        assertThat(position).isEqualTo(new CursorPosition.Unrecognised("1700000000123_evt-7"));
    }

    @ParameterizedTest
    @ValueSource(strings = {"not base64 at all!", "%%%%", "k1|name|ASC|5|65f1a2b3c4d5e6f708192a3b"})
    void parse_notBase64_throwsInvalidCursor(String rawInput) {
        // execution
        Throwable thrown = catchThrowable(() -> KeysetCursor.parse(rawInput));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @ParameterizedTest
    @ValueSource(strings = {
            "k1|",
            "k1|name",
            "k1|name|ASC|5",
            "k1||ASC|5|65f1a2b3c4d5e6f708192a3b",
            "k1|name|UP|5|65f1a2b3c4d5e6f708192a3b",
            "k1|name|asc|5|65f1a2b3c4d5e6f708192a3b",
            "k1|name||5|65f1a2b3c4d5e6f708192a3b",
            "k1|name|ASC|5|",
            "k1|name|ASC|5|  "
    })
    void parse_malformedKeysetPayload_throwsInvalidCursor(String payload) {
        // setup
        String rawInput = standardBase64(payload);

        // execution
        Throwable thrown = catchThrowable(() -> KeysetCursor.parse(rawInput));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @Test
    void requireSort_sameFieldAndDirection_passes() {
        // setup
        KeysetCursor cursor = KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, CREATED_AT_VALUE, ROW_ID);

        // execution
        Throwable thrown = catchThrowable(
                () -> cursor.requireSort(CREATED_AT, Sort.Direction.DESC));

        // verifications
        assertThat(thrown).isNull();
    }

    @ParameterizedTest
    @CsvSource({
            "updatedAt, DESC",
            "createdAt, ASC",
            "name, ASC"
    })
    void requireSort_anotherFieldOrDirection_throwsInvalidCursor(String sortField, Sort.Direction direction) {
        // setup
        KeysetCursor cursor = KeysetCursor.ofInstant(CREATED_AT, Sort.Direction.DESC, CREATED_AT_VALUE, ROW_ID);

        // execution
        Throwable thrown = catchThrowable(
                () -> cursor.requireSort(sortField, direction));

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @ParameterizedTest
    @ValueSource(strings = {"abc", "12.5", "QWNtZQ==", "="})
    void instantValue_valueIsNotEpochMillis_throwsInvalidCursor(String rawValue) {
        // setup
        KeysetCursor cursor = new KeysetCursor(CREATED_AT, Sort.Direction.DESC, rawValue, ROW_ID);

        // execution
        Throwable thrown = catchThrowable(cursor::instantValue);

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @Test
    void instantValue_negativeEpochMillis_instantBeforeTheEpoch() {
        // setup
        KeysetCursor cursor = new KeysetCursor(CREATED_AT, Sort.Direction.DESC, "-1000", ROW_ID);

        // execution
        Instant value = cursor.instantValue();

        // verifications
        assertThat(value).isEqualTo(Instant.ofEpochMilli(-1000L));
    }

    @ParameterizedTest
    @ValueSource(strings = {"%%%", "a", "not base64"})
    void stringValue_valueIsNotBase64_throwsInvalidCursor(String rawValue) {
        // setup
        KeysetCursor cursor = new KeysetCursor(NAME, Sort.Direction.ASC, rawValue, ROW_ID);

        // execution
        Throwable thrown = catchThrowable(cursor::stringValue);

        // verifications
        assertThat(thrown)
                .isInstanceOf(InvalidCursorException.class)
                .hasMessage(INVALID_CURSOR);
    }

    @Test
    void stringValue_unicodeValue_sameString() {
        // setup
        String value = "Żółć & Söhne / 東京";
        KeysetCursor cursor = KeysetCursor.ofString(NAME, Sort.Direction.ASC, value, ROW_ID);

        // execution
        String decoded = cursor.stringValue();

        // verifications
        assertThat(decoded).isEqualTo(value);
    }

    private static Stream<Arguments> incompleteCursors() {
        return Stream.of(
                arguments(null, Sort.Direction.ASC, ROW_ID),
                arguments(" ", Sort.Direction.ASC, ROW_ID),
                arguments(NAME, null, ROW_ID),
                arguments(NAME, Sort.Direction.ASC, null),
                arguments(NAME, Sort.Direction.ASC, " "));
    }

    private static Stream<Arguments> sameCursorInEachAlphabet() {
        byte[] payload = ("k1|eventTimestamp|DESC|1700000000123|" + ID_ENCODED_WITH_PLUS_AND_SLASH)
                .getBytes(StandardCharsets.UTF_8);
        return Stream.of(
                arguments(Base64.getEncoder().encodeToString(payload)),
                arguments(Base64.getUrlEncoder().encodeToString(payload)),
                arguments(Base64.getUrlEncoder().withoutPadding().encodeToString(payload)));
    }

    private static String standardBase64(String text) {
        return Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
    }
}
