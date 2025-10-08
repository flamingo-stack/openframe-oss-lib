package com.openframe.security.oauth.headers;

import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;

@Component
@Primary
@ConditionalOnMissingBean(value = ForwardedHeadersContributor.class, ignored = NoopForwardedHeadersContributor.class)
public class NoopForwardedHeadersContributor implements ForwardedHeadersContributor {
    @Override
    public void contribute(HttpHeaders headers, ServerHttpRequest request) {
        // no-op
    }
}


