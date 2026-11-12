package com.openframe.gateway.service;

import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import com.openframe.data.reactive.service.AuditCaller;
import com.openframe.data.reactive.service.ReactiveAuditEventWriter;
import com.openframe.data.service.AuditTenantResolver;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.util.List;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.model.audit.AuditConstants.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditRecorder {

    private static final Duration ONCE_WINDOW = Duration.ofMinutes(1);

    private final ReactiveApiKeyRepository apiKeyRepository;
    private final AuditTenantResolver tenantResolver;
    private final ReactiveAuditEventWriter writer;

    public Mono<Void> record(AuditEntry entry, ServerHttpRequest request) {
        return recordAll(List.of(entry), request);
    }

    public Mono<Void> recordAll(List<AuditEntry> entries, ServerHttpRequest request) {
        return writer.writeAll(entries, callerOf(request));
    }

    public Mono<Void> record(AuditEntry entry, ServerHttpRequest request, AuditActor actor) {
        return writer.writeAll(List.of(entry), Mono.fromSupplier(() -> caller(actor, null, request)));
    }

    public Mono<Void> record(AuditEntry entry, AuditCaller caller) {
        return writer.writeAll(List.of(entry), Mono.just(caller));
    }

    public Mono<Void> recordOnce(AuditEntry entry, ServerHttpRequest request, String key) {
        return recordOnce(entry, request, key, ONCE_WINDOW);
    }

    public Mono<Void> recordOnce(AuditEntry entry, ServerHttpRequest request, String key, Duration window) {
        return writer.writeOnce(entry, callerOf(request), key, window);
    }

    public Mono<Void> recordOnce(AuditEntry entry, ServerHttpRequest request, AuditActor actor, String key) {
        return writer.writeOnce(entry, Mono.fromSupplier(() -> caller(actor, null, request)), key, ONCE_WINDOW);
    }

    public Mono<AuditCaller> callerOf(ServerHttpRequest request) {
        return currentJwt()
                .map(jwt -> caller(actorOf(jwt), jwt.getClaimAsString(SESSION_CLAIM), request))
                .switchIfEmpty(Mono.defer(() -> actorOfApiKey(request)
                        .defaultIfEmpty(AuditActor.system())
                        .map(actor -> caller(actor, null, request))));
    }

    private AuditCaller caller(AuditActor actor, String sessionId, ServerHttpRequest request) {
        String routedTenantId = TenantRoutingHeaders.tenantId(request);
        String servedTenantId = StringUtils.hasText(routedTenantId) ? routedTenantId : tenantResolver.servedTenantId();
        return new AuditCaller(actor, AuditRequestInfo.fromHeaders(request.getHeaders()::getFirst, sessionId),
                servedTenantId);
    }

    private AuditActor actorOf(Jwt jwt) {
        AuthPrincipal principal = AuthPrincipal.fromJwt(jwt);
        return principal.getActorType() == ActorType.AGENT
                ? AuditActor.fromAgent(principal.getMachineId(), principal.getRoles(), principal.getTenantId())
                : AuditActor.fromUser(principal.getId(), principal.getEmail(), principal.getRoles(),
                        principal.getTenantId(), tenantResolver.superTenantId());
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
