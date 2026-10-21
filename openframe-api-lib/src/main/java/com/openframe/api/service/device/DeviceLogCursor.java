package com.openframe.api.service.device;

import com.openframe.api.dto.shared.CursorCodec;

/**
 * Position in a newest-first device log listing: the Loki timestamp of the last returned line. A page never splits
 * the lines that share a timestamp, so the next page is read from strictly before it.
 */
record DeviceLogCursor(long timestampNanos) {

    String encode() {
        return CursorCodec.encode(String.valueOf(timestampNanos));
    }

    /**
     * Parses a cursor already base64-decoded by {@code CursorPaginationCriteria}; {@code null} when absent.
     */
    static DeviceLogCursor fromRaw(String raw) {
        return DeviceLogArgumentContract.cursorTimestamp(raw).map(DeviceLogCursor::new).orElse(null);
    }
}
