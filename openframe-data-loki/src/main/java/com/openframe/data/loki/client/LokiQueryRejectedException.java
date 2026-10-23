package com.openframe.data.loki.client;

/**
 * Loki refused the query itself rather than failing to run it - it asked for more than a limit allows, most often the
 * per-request byte ceiling. Separate from {@link LokiQueryException} so callers can answer "narrow your search" instead
 * of "logs are temporarily unavailable", which would invite a retry into the same wall.
 */
public class LokiQueryRejectedException extends LokiQueryException {

    public LokiQueryRejectedException(String message, Throwable cause) {
        super(message, cause);
    }
}
