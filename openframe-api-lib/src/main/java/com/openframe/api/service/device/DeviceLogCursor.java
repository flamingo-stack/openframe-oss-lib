package com.openframe.api.service.device;

import com.openframe.api.dto.shared.CursorCodec;
import lombok.Getter;
import lombok.RequiredArgsConstructor;

/**
 * Position in a newest-first device log listing: the Loki timestamp of the last returned line. A page never splits
 * the lines that share a timestamp, so the next page is read from strictly before it.
 */
@Getter
@RequiredArgsConstructor
class DeviceLogCursor {

    private final long timestampNanos;

    String encode() {
        return CursorCodec.encode(String.valueOf(timestampNanos));
    }

    /**
     * Parses a cursor already base64-decoded by {@code CursorPaginationCriteria}; {@code null} when absent.
     */
    static DeviceLogCursor fromRaw(String raw) {
        if (raw == null) {
            return null;
        }
        try {
            long timestampNanos = Long.parseLong(raw);
            if (timestampNanos > 0) {
                return new DeviceLogCursor(timestampNanos);
            }
        } catch (NumberFormatException ignored) {
            // fall through to the rejection below
        }
        throw new IllegalArgumentException("Invalid cursor");
    }
}
