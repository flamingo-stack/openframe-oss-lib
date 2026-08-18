package com.openframe.gateway.filter;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.Tracer;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import org.springframework.web.server.WebFilter;
import org.springframework.web.server.WebFilterChain;
import reactor.core.publisher.Mono;

/**
 * Exposes the current trace id as an X-Trace-Id response header so a failing
 * request can be looked up in Loki without access to server logs.
 */
@Component
@RequiredArgsConstructor
public class TraceIdResponseHeaderFilter implements WebFilter {

    public static final String TRACE_ID_HEADER = "X-Trace-Id";

    private final Tracer tracer;

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, WebFilterChain chain) {
        exchange.getResponse().beforeCommit(() -> Mono.deferContextual(ctx -> {
            Span span = tracer.currentSpan();
            if (span != null) {
                exchange.getResponse().getHeaders().set(TRACE_ID_HEADER, span.context().traceId());
            }
            return Mono.empty();
        }));
        return chain.filter(exchange);
    }
}
