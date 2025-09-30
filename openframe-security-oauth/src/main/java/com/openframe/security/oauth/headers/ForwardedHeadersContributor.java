package com.openframe.security.oauth.headers;

import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;

/**
 * Extension point to add forwarded or custom headers to outbound calls
 * from the BFF to the Authorization Server.
 */
public interface ForwardedHeadersContributor {

    /**
     * Contribute headers to the outbound request.
     * Implementations should be idempotent.
     *
     * @param headers mutable headers to modify
     * @param request current inbound request (may be null)
     */
    void contribute(HttpHeaders headers, ServerHttpRequest request);
}


