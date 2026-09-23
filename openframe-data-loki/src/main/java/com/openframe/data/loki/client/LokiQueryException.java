package com.openframe.data.loki.client;

public class LokiQueryException extends RuntimeException {

    public LokiQueryException(String message) {
        super(message);
    }

    public LokiQueryException(String message, Throwable cause) {
        super(message, cause);
    }
}
