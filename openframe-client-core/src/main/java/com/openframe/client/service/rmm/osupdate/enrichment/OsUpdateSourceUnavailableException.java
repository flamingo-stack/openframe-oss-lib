package com.openframe.client.service.rmm.osupdate.enrichment;

import lombok.Getter;

@Getter
public class OsUpdateSourceUnavailableException extends RuntimeException {

    private final OsUpdateSource osUpdateSource;

    public OsUpdateSourceUnavailableException(OsUpdateSource osUpdateSource, String message, Throwable cause) {
        super(message, cause);
        this.osUpdateSource = osUpdateSource;
    }

    public OsUpdateSourceUnavailableException(OsUpdateSource osUpdateSource, String message) {
        super(message);
        this.osUpdateSource = osUpdateSource;
    }
}
