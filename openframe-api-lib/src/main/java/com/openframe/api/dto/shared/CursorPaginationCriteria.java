package com.openframe.api.dto.shared;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CursorPaginationCriteria {

    private Integer limit;
    private String cursor;
    private boolean backward;

    public static final int DEFAULT_PAGE_SIZE = 20;
    public static final int MIN_PAGE_SIZE = 1;
    public static final int MAX_PAGE_SIZE = 100;

    /**
     * Build pagination criteria from Relay Connection Spec arguments.
     * Backward pagination (last/before) takes precedence if both directions are provided.
     * Opaque cursors are decoded automatically via {@link CursorCodec}.
     */
    public static CursorPaginationCriteria fromConnectionArgs(ConnectionArgs args) {
        if (args == null) {
            return new CursorPaginationCriteria();
        }

        if (args.getLast() != null || args.getBefore() != null) {
            return CursorPaginationCriteria.builder()
                    .limit(args.getLast())
                    .cursor(CursorCodec.decode(args.getBefore()))
                    .backward(true)
                    .build();
        }

        return CursorPaginationCriteria.builder()
                .limit(args.getFirst())
                .cursor(CursorCodec.decode(args.getAfter()))
                .backward(false)
                .build();
    }

    public CursorPaginationCriteria normalize() {
        int requestedLimit = limit != null ? limit : DEFAULT_PAGE_SIZE;
        int normalizedLimit = Math.min(Math.max(MIN_PAGE_SIZE, requestedLimit), MAX_PAGE_SIZE);

        return CursorPaginationCriteria.builder()
                .limit(normalizedLimit)
                .cursor(cursor)
                .backward(backward)
                .build();
    }

    /**
     * Build pagination criteria from REST API parameters.
     * Opaque cursors are decoded automatically via {@link CursorCodec}.
     */
    public static CursorPaginationCriteria fromRest(String cursor, Integer limit) {
        int validLimit = (limit != null && limit >= MIN_PAGE_SIZE && limit <= MAX_PAGE_SIZE)
                ? limit : DEFAULT_PAGE_SIZE;
        return CursorPaginationCriteria.builder()
                .cursor(CursorCodec.decode(cursor))
                .limit(validLimit)
                .backward(false)
                .build();
    }

    public boolean hasCursor() {
        return cursor != null && !cursor.trim().isEmpty();
    }
}
