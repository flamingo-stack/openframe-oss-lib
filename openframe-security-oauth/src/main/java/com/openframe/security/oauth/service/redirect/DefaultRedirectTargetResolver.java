package com.openframe.security.oauth.service.redirect;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Mono;

import static org.springframework.http.HttpHeaders.REFERER;

@Component
@ConditionalOnMissingBean(value = RedirectTargetResolver.class, ignored = DefaultRedirectTargetResolver.class)
public class DefaultRedirectTargetResolver implements RedirectTargetResolver {
    @Override
    public Mono<String> resolve(String tenantId, String requestedRedirectTo, ServerHttpRequest request) {
        String target = requestedRedirectTo;
        if (!StringUtils.hasText(target)) {
            String referer = request.getHeaders().getFirst(REFERER);
            if (StringUtils.hasText(referer)) {
                target = referer;
            }
        }
        if (!StringUtils.hasText(target)) {
            target = "/";
        }
        return Mono.just(target);
    }
}


