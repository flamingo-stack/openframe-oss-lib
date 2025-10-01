package com.openframe.security.oauth.service.redirect;

import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.web.server.WebSession;
import reactor.core.publisher.Mono;

public interface RedirectTargetResolver {
    Mono<String> resolve(String tenantId, String requestedRedirectTo, WebSession session, ServerHttpRequest request);
}
