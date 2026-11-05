package com.openframe.gateway.service;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import com.openframe.data.reactive.service.ReactiveAuditEventWriter;
import com.openframe.data.repository.redis.ReactiveAuditOnceRepository;
import com.openframe.data.service.AuditTenants;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.Objects;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditRecorder {

    private static final Duration ONCE_WINDOW = Duration.ofMinutes(1);

    private final ReactiveApiKeyRepository apiKeyRepository;
    private final ReactiveAuditOnceRepository auditOnceRepository;
    private final AuditTenants auditTenants;
    private final ReactiveAuditEventWriter writer;

    public Mono<Void> record(AuditEntry entry, ServerWebExchange exchange) {
        return callerOf(exchange).flatMap(caller -> write(entry, exchange, caller));
    }

    public Mono<Void> record(AuditEntry entry, ServerWebExchange exchange, AuditActor actor) {
        return write(entry, exchange, new Caller(actor, null));
    }

    public Mono<Void> recordOnce(AuditEntry entry, ServerWebExchange exchange, String key) {
        return callerOf(exchange).flatMap(caller -> writeOnce(entry, exchange, caller, key));
    }

    public Mono<Void> recordOnce(AuditEntry entry, ServerWebExchange exchange, AuditActor actor, String key) {
        return writeOnce(entry, exchange, new Caller(actor, null), key);
    }

    private record Caller(AuditActor actor, String sessionId) {
    }

    private Mono<Void> writeOnce(AuditEntry entry, ServerWebExchange exchange, Caller caller, String key) {
        String onceKey = entry.getAction().getName() + ":" + key + ":"
                + Objects.requireNonNullElse(caller.actor().id(), "-");
        return auditOnceRepository.claim(onceKey, ONCE_WINDOW, TenantRoutingHeaders.tenantId(exchange.getRequest()))
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit dedupe lookup failed, the event is recorded", e);
                    return Mono.just(true);
                })
                .flatMap(first -> first ? write(entry, exchange, caller) : Mono.empty());
    }

    private Mono<Void> write(AuditEntry entry, ServerWebExchange exchange, Caller caller) {
        ServerHttpRequest request = exchange.getRequest();
        HttpHeaders headers = request.getHeaders();
        AuditSource source = new AuditSource(headers.getFirst(CLIENT_IP_HEADER), headers.getFirst(HttpHeaders.USER_AGENT),
                headers.getFirst(REQUEST_ID_HEADER), caller.sessionId());
        String routedTenantId = TenantRoutingHeaders.tenantId(request);
        String tenantId = caller.actor().tenantFor(entry.getTenantId(), auditTenants.superTenantId(),
                () -> StringUtils.hasText(routedTenantId) ? routedTenantId : auditTenants.servedTenantId());
        return writer.write(entry, caller.actor(), source, tenantId);
    }

    private Mono<Caller> callerOf(ServerWebExchange exchange) {
        return currentJwt()
                .map(jwt -> new Caller(actorOf(jwt), jwt.getClaimAsString(SESSION_CLAIM)))
                .switchIfEmpty(Mono.defer(() -> actorOfApiKey(exchange.getRequest())
                        .defaultIfEmpty(AuditActor.system())
                        .map(actor -> new Caller(actor, null))));
    }

    private AuditActor actorOf(Jwt jwt) {
        AuthPrincipal principal = AuthPrincipal.fromJwt(jwt);
        return principal.getActorType() == ActorType.AGENT
                ? AuditActor.fromAgent(principal.getMachineId(), principal.getRoles(), principal.getTenantId())
                : AuditActor.fromUser(principal.getId(), principal.getEmail(), principal.getRoles(),
                        principal.getTenantId(), auditTenants.superTenantId());
    }

    private Mono<AuditActor> actorOfApiKey(ServerHttpRequest request) {
        String keyId = request.getHeaders().getFirst(X_API_KEY_ID);
        if (!StringUtils.hasText(keyId)) {
            return Mono.empty();
        }
        String ownerId = request.getHeaders().getFirst(X_USER_ID);
        return apiKeyRepository.findById(keyId)
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit lookup failed, the event is stored without its result", e);
                    return Mono.empty();
                })
                .map(key -> AuditActor.fromApiKey(keyId, key.getName(), key.getRoles(), key.getTenantId(), ownerId))
                .defaultIfEmpty(AuditActor.fromApiKey(keyId, null, null, null, ownerId));
    }

    private static Mono<Jwt> currentJwt() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(SecurityContext::getAuthentication)
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(JwtAuthenticationToken::getToken);
    }
}
