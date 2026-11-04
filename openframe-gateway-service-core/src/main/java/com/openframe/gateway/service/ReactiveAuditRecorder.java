package com.openframe.gateway.service;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.reactive.repository.apikey.ReactiveApiKeyRepository;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.data.service.AuditTenants;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.security.core.context.ReactiveSecurityContextHolder;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;


import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.document.audit.AuditActorType.FAE;
import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class ReactiveAuditRecorder {

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ReactiveApiKeyRepository apiKeyRepository;
    private final AuditTenants auditTenants;
    private final AuditEventMapper auditEventMapper;
    private final ObjectMapper objectMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public Mono<Void> record(AuditEntry entry, ServerWebExchange exchange) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        if (!enabled) {
            return Mono.empty();
        }
        ServerHttpRequest request = exchange.getRequest();
        return currentJwt()
                .flatMap(jwt -> buildEvent(entry, request, actorOf(jwt), jwt.getClaimAsString(SESSION_CLAIM)))
                .switchIfEmpty(Mono.defer(() -> actorOfApiKey(request)
                        .defaultIfEmpty(AuditActor.system())
                        .flatMap(actor -> buildEvent(entry, request, actor, null))))
                .flatMap(this::save)
                .onErrorResume(e -> {
                    log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
                    return Mono.empty();
                });
    }

    private Mono<AuditEvent> buildEvent(AuditEntry entry, ServerHttpRequest request, AuditActor actor,
                                        String sessionId) {
        AuditSource source = new AuditSource(request.getHeaders().getFirst(CLIENT_IP_HEADER),
                request.getHeaders().getFirst(HttpHeaders.USER_AGENT),
                request.getHeaders().getFirst(REQUEST_ID_HEADER), sessionId);
        String routedTenantId = TenantRoutingHeaders.tenantId(request);
        String tenantId = actor.tenantFor(entry.getTenantId(), auditTenants.superTenantId(),
                () -> StringUtils.hasText(routedTenantId) ? routedTenantId : auditTenants.servedTenantId());
        AuditEvent event = auditEventMapper.toEvent(entry, actor, source, tenantId);
        return Mono.when(nameOf(actor).doOnNext(event::setActorName),
                        onBehalfOfNameOf(actor).doOnNext(event::setOnBehalfOfName))
                .thenReturn(event);
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
        return lookup(apiKeyRepository.findById(keyId))
                .map(key -> AuditActor.fromApiKey(keyId, key.getName(), key.getRoles(), key.getTenantId(), ownerId))
                .defaultIfEmpty(AuditActor.fromApiKey(keyId, null, null, null, ownerId));
    }

    private Mono<String> nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return Mono.just(actor.name());
        }
        if (actor.id() == null) {
            return Mono.empty();
        }
        return switch (actor.type()) {
            case USER, STAFF -> lookup(userRepository.findById(actor.id())).mapNotNull(User::fullName);
            case DEVICE -> lookup(machineRepository.findByMachineId(actor.id())).mapNotNull(Machine::getHostname);
            default -> Mono.empty();
        };
    }

    private Mono<String> onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return Mono.empty();
        }
        return actor.type() == FAE
                ? lookup(machineRepository.findByMachineId(actor.onBehalfOfId())).mapNotNull(Machine::getHostname)
                : lookup(userRepository.findById(actor.onBehalfOfId())).mapNotNull(User::fullName);
    }

    private Mono<Void> save(AuditEvent event) {
        return auditEventRepository.insert(event)
                .then()
                .onErrorResume(DataAccessException.class, e -> {
                    log.error("Audit event not stored: {}", asJson(event), e);
                    return Mono.empty();
                });
    }

    private String asJson(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JacksonException e) {
            return event.toString();
        }
    }

    private static <T> Mono<T> lookup(Mono<T> query) {
        return query.onErrorResume(DataAccessException.class, e -> {
            log.error("Audit lookup failed, the event is stored without its result", e);
            return Mono.empty();
        });
    }

    private static Mono<Jwt> currentJwt() {
        return ReactiveSecurityContextHolder.getContext()
                .mapNotNull(SecurityContext::getAuthentication)
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(JwtAuthenticationToken::getToken);
    }
}
