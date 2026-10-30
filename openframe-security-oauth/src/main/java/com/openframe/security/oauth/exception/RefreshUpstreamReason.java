package com.openframe.security.oauth.exception;

import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
@AllArgsConstructor
public enum RefreshUpstreamReason {
    CLIENT_REJECTED(HttpStatus.BAD_GATEWAY, "Auth server rejected the gateway client credentials"),
    UPSTREAM_ERROR(HttpStatus.BAD_GATEWAY, "Auth server failed to process the refresh"),
    UPSTREAM_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "Auth server is unreachable");

    private final HttpStatus httpStatus;
    private final String message;
}
