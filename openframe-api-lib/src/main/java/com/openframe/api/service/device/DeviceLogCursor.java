package com.openframe.api.service.device;

import com.openframe.api.dto.shared.CursorCodec;

/**
 * Position in a newest-first device log listing: the Loki timestamp of the last returned entry and how many
 * entries at exactly that timestamp have been returned so far. Loki has no offsets, so the next page is read
 * up to and including that timestamp and the already returned entries at it are skipped.
 */
record DeviceLogCursor(long timestampNanos, int skip) {

    static final int MAX_SKIP = 1000;

    String encode() {
        return CursorCodec.encode(timestampNanos + ":" + skip);
    }

    /**
     * Parses a cursor already base64-decoded by {@code CursorPaginationCriteria}; {@code null} when absent.
     */
    static DeviceLogCursor fromRaw(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            int separator = raw.indexOf(':');
            long timestampNanos = Long.parseLong(raw.substring(0, separator));
            int skip = Integer.parseInt(raw.substring(separator + 1));
            if (timestampNanos > 0 && skip >= 0 && skip <= MAX_SKIP) {
                return new DeviceLogCursor(timestampNanos, skip);
            }
        } catch (RuntimeException ignored) {
            // fall through to the rejection below
        }
        throw new IllegalArgumentException("Invalid cursor");
    }
}
