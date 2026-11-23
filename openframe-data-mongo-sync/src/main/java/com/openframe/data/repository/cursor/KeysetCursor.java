package com.openframe.data.repository.cursor;

import org.springframework.data.domain.Sort;

import java.time.Instant;

public record KeysetCursor(String sortField, Sort.Direction direction, String rawValue, String id)
        implements CursorPosition {

    public static KeysetCursor ofInstant(String sortField, Sort.Direction direction, Instant value, String id) {
        throw new UnsupportedOperationException();
    }

    public static KeysetCursor ofString(String sortField, Sort.Direction direction, String value, String id) {
        throw new UnsupportedOperationException();
    }

    public static CursorPosition parse(String rawInput) {
        throw new UnsupportedOperationException();
    }

    public String encode() {
        throw new UnsupportedOperationException();
    }

    public void requireSort(String expectedSortField, Sort.Direction expectedDirection) {
        throw new UnsupportedOperationException();
    }

    public boolean hasNullValue() {
        throw new UnsupportedOperationException();
    }

    public Instant instantValue() {
        throw new UnsupportedOperationException();
    }

    public String stringValue() {
        throw new UnsupportedOperationException();
    }
}
