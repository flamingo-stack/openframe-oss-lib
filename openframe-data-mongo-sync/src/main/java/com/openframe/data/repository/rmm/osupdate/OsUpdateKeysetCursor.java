package com.openframe.data.repository.rmm.osupdate;

import com.openframe.core.exception.BadRequestException;
import lombok.Value;

import java.time.Instant;

import static org.apache.commons.lang3.StringUtils.isBlank;

// The full sort key of a page's last row: its time, then the key that orders rows of the same time.
@Value
public class OsUpdateKeysetCursor {

    private static final String SEPARATOR = "|";

    Instant instant;
    String key;

    public static String encode(Instant instant, String key) {
        return instant.toEpochMilli() + SEPARATOR + key;
    }

    public static OsUpdateKeysetCursor parse(String cursor) {
        int separator = cursor.indexOf(SEPARATOR);
        if (separator < 0) {
            throw new BadRequestException("Invalid OS update cursor (no separator): " + cursor);
        }
        String millis = cursor.substring(0, separator);
        String key = cursor.substring(separator + 1);
        if (isBlank(key)) {
            throw new BadRequestException("Invalid OS update cursor (no key): " + cursor);
        }
        return new OsUpdateKeysetCursor(parseInstant(millis), key);
    }

    private static Instant parseInstant(String millis) {
        try {
            return Instant.ofEpochMilli(Long.parseLong(millis));
        } catch (NumberFormatException unparseable) {
            throw new BadRequestException("Unparseable epoch millis in OS update cursor: " + millis);
        }
    }
}
