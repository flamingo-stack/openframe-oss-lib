package com.openframe.gateway.filter;

import io.micrometer.tracing.Span;
import io.micrometer.tracing.TraceContext;
import io.micrometer.tracing.Tracer;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class TraceIdResponseHeaderFilterTest {

    private static final String TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";

    @Test
    void addsTraceIdHeaderWhenSpanPresent() {
        Tracer tracer = mock(Tracer.class);
        Span span = mock(Span.class);
        TraceContext context = mock(TraceContext.class);
        when(tracer.currentSpan()).thenReturn(span);
        when(span.context()).thenReturn(context);
        when(context.traceId()).thenReturn(TRACE_ID);

        MockServerWebExchange exchange =
                MockServerWebExchange.from(MockServerHttpRequest.get("/api/test"));
        TraceIdResponseHeaderFilter filter = new TraceIdResponseHeaderFilter(tracer);

        filter.filter(exchange, ex -> ex.getResponse().setComplete()).block();

        assertEquals(TRACE_ID,
                exchange.getResponse().getHeaders().getFirst(TraceIdResponseHeaderFilter.TRACE_ID_HEADER));
    }

    @Test
    void noHeaderWhenNoCurrentSpan() {
        Tracer tracer = mock(Tracer.class);
        when(tracer.currentSpan()).thenReturn(null);

        MockServerWebExchange exchange =
                MockServerWebExchange.from(MockServerHttpRequest.get("/api/test"));
        TraceIdResponseHeaderFilter filter = new TraceIdResponseHeaderFilter(tracer);

        filter.filter(exchange, ex -> ex.getResponse().setComplete()).block();

        assertNull(exchange.getResponse().getHeaders()
                .getFirst(TraceIdResponseHeaderFilter.TRACE_ID_HEADER));
    }
}
