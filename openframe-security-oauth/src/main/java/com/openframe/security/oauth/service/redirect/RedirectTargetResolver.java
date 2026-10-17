package com.openframe.security.oauth.service.redirect;

import org.springframework.http.server.reactive.ServerHttpRequest;
import reactor.core.publisher.Mono;

public interface RedirectTargetResolver {

    // Resolve where to send the browser after a successful code exchange; userId may be null when it could not be read from the issued token.
    Mono<String> resolve(String tenantId, String userId, String requestedRedirectTo, ServerHttpRequest request);

    /**
     * Whether the URI is on the deployment's exact redirect allow-list (native-app callback URIs).
     * Used by hops that hand a sensitive handle (signup ticket) to a client-supplied target — the
     * default fails closed; the SaaS resolver exposes its configured list.
     */
    default boolean isAllowedRedirectUri(String uri) {
        return false;
    }
}

