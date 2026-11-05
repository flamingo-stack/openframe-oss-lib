package com.openframe.gateway.security;

import com.openframe.data.document.audit.AuditEntry;
import com.openframe.gateway.service.ReactiveAuditRecorder;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.server.authorization.HttpStatusServerAccessDeniedHandler;
import org.springframework.security.web.server.authorization.ServerAccessDeniedHandler;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AUTH_ACCESS_DENY;
import static com.openframe.data.document.audit.AuditOutcome.REFUSED;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;

@Component
@RequiredArgsConstructor
public class AuditAccessDeniedHandler implements ServerAccessDeniedHandler {

    private final ReactiveAuditRecorder auditRecorder;
    private final ServerAccessDeniedHandler delegate = new HttpStatusServerAccessDeniedHandler(HttpStatus.FORBIDDEN);

    @Override
    public Mono<Void> handle(ServerWebExchange exchange, AccessDeniedException denied) {
        ServerHttpRequest request = exchange.getRequest();
        AuditEntry entry = AuditEntry.builder()
                .action(AUTH_ACCESS_DENY)
                .outcome(REFUSED)
                .reason(denied.getMessage())
                .targetId(request.getHeaders().getFirst(REQUEST_ID_HEADER))
                .details(Map.of("method", request.getMethod().name(), "path", request.getPath().value()))
                .build();
        return auditRecorder.record(entry, exchange).then(delegate.handle(exchange, denied));
    }
}
