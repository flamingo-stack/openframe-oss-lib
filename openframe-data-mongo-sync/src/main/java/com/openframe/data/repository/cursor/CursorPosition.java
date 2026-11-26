package com.openframe.data.repository.cursor;

public sealed interface CursorPosition
        permits KeysetCursor, CursorPosition.RowId, CursorPosition.Unrecognised, CursorPosition.None {

    record RowId(String id) implements CursorPosition {
    }

    record Unrecognised(String decoded) implements CursorPosition {
    }

    record None() implements CursorPosition {
    }
}
