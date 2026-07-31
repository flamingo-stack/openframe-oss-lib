package com.openframe.security.oauth.service.redirect;

import org.springframework.http.server.reactive.ServerHttpRequest;
import reactor.core.publisher.Mono;

public interface RedirectTargetResolver {

    /**
     * Resolve where to send the browser after a successful code exchange.
     *
     * @param tenantId          tenant the user authenticated into
     * @param userId            authenticated user's id ({@code sub} claim), or {@code null} when it
     *                          could not be read from the issued token
     * @param requestedRedirectTo redirect requested by the client, may be {@code null}
     */
    Mono<String> resolve(String tenantId, String userId, String requestedRedirectTo, ServerHttpRequest request);
}
