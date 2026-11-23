package com.openframe.data.repository.cursor;

import com.openframe.core.exception.InvalidCursorException;
import org.bson.types.ObjectId;
import org.springframework.data.domain.Sort;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isBlank;

public record KeysetCursor(String sortField, Sort.Direction direction, String rawValue, String id)
        implements CursorPosition {

    private static final String VERSION = "k1";
    private static final String SEPARATOR = "|";
    private static final String PAYLOAD_PREFIX = VERSION + SEPARATOR;
    private static final Pattern SEPARATOR_PATTERN = Pattern.compile(SEPARATOR, Pattern.LITERAL);
    private static final int PAYLOAD_PARTS = 5;
    private static final String NULL_VALUE = "";
    private static final String EMPTY_STRING_VALUE = "=";

    public KeysetCursor {
        if (isBlank(sortField) || direction == null || isBlank(id)) {
            throw new IllegalArgumentException("A keyset cursor needs a sort field, a direction and an id");
        }
        rawValue = rawValue == null ? NULL_VALUE : rawValue;
        if (sortField.contains(SEPARATOR) || rawValue.contains(SEPARATOR)) {
            throw new IllegalArgumentException("A keyset cursor part cannot contain " + SEPARATOR);
        }
    }

    public static KeysetCursor ofInstant(String sortField, Sort.Direction direction, Instant value, String id) {
        String rawValue = value == null ? NULL_VALUE : Long.toString(value.toEpochMilli());
        return new KeysetCursor(sortField, direction, rawValue, id);
    }

    public static KeysetCursor ofString(String sortField, Sort.Direction direction, String value, String id) {
        String rawValue = encodeString(value);
        return new KeysetCursor(sortField, direction, rawValue, id);
    }

    public static CursorPosition parse(String rawInput) {
        if (isBlank(rawInput)) {
            return new CursorPosition.None();
        }
        if (ObjectId.isValid(rawInput)) {
            return new CursorPosition.RowId(rawInput);
        }
        String decoded = CursorBase64.decode(rawInput);
        if (decoded.startsWith(PAYLOAD_PREFIX)) {
            return parsePayload(decoded);
        }
        if (ObjectId.isValid(decoded)) {
            return new CursorPosition.RowId(decoded);
        }
        return new CursorPosition.Unrecognised(decoded);
    }

    public String encode() {
        String payload = String.join(SEPARATOR, VERSION, sortField, direction.name(), rawValue, id);
        return Base64.getEncoder().encodeToString(payload.getBytes(StandardCharsets.UTF_8));
    }

    public void requireSort(String expectedSortField, Sort.Direction expectedDirection) {
        if (!sortField.equals(expectedSortField) || direction != expectedDirection) {
            throw new InvalidCursorException();
        }
    }

    public boolean hasNullValue() {
        return rawValue.isEmpty();
    }

    public Instant instantValue() {
        if (hasNullValue()) {
            return null;
        }
        try {
            long epochMillis = Long.parseLong(rawValue);
            return Instant.ofEpochMilli(epochMillis);
        } catch (NumberFormatException e) {
            throw new InvalidCursorException(e);
        }
    }

    public String stringValue() {
        if (hasNullValue()) {
            return null;
        }
        if (EMPTY_STRING_VALUE.equals(rawValue)) {
            return "";
        }
        try {
            byte[] decoded = Base64.getDecoder().decode(rawValue);
            return new String(decoded, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
    }

    private static KeysetCursor parsePayload(String payload) {
        String[] parts = SEPARATOR_PATTERN.split(payload, PAYLOAD_PARTS);
        if (parts.length != PAYLOAD_PARTS) {
            throw new InvalidCursorException();
        }
        String sortField = parts[1];
        String directionName = parts[2];
        String rawValue = parts[3];
        String id = parts[4];
        try {
            Sort.Direction direction = Sort.Direction.valueOf(directionName);
            return new KeysetCursor(sortField, direction, rawValue, id);
        } catch (IllegalArgumentException e) {
            throw new InvalidCursorException(e);
        }
    }

    private static String encodeString(String value) {
        if (value == null) {
            return NULL_VALUE;
        }
        if (value.isEmpty()) {
            return EMPTY_STRING_VALUE;
        }
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }
}
