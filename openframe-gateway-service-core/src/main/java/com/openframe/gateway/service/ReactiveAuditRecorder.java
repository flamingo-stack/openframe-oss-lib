package com.openframe.gateway.service;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.reactive.repository.audit.ReactiveAuditEventRepository;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import com.openframe.gateway.tenant.TenantRoutingHeaders;
import com.openframe.security.authentication.AuthPrincipal;
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

import java.time.Instant;
import java.util.Objects;
import java.util.stream.Stream;

import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.SESSION_CLAIM;
import static java.util.stream.Collectors.joining;

@Slf4j
@Service
public class ReactiveAuditRecorder {

    private final ReactiveAuditEventRepository auditEventRepository;
    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ObjectMapper objectMapper;
    private final String superTenantId;

    public ReactiveAuditRecorder(ReactiveAuditEventRepository auditEventRepository,
                                 ReactiveUserRepository userRepository,
                                 ReactiveMachineRepository machineRepository,
                                 ObjectMapper objectMapper,
                                 @Value("${openframe.security.jwt.super-tenant-id}") String superTenantId) {
        this.auditEventRepository = auditEventRepository;
        this.userRepository = userRepository;
        this.machineRepository = machineRepository;
        this.objectMapper = objectMapper;
        this.superTenantId = superTenantId;
    }

    public Mono<Void> record(AuditEntry entry, ServerWebExchange exchange) {
        Assert.notNull(entry.getAction(), "action is required");
        Assert.notNull(entry.getOutcome(), "outcome is required");
        return currentJwt()
                .flatMap(jwt -> buildEvent(entry, exchange, actorOf(jwt), jwt.getClaimAsString(SESSION_CLAIM)))
                .switchIfEmpty(Mono.defer(() -> buildEvent(entry, exchange, AuditActor.system(), null)))
                .flatMap(this::save);
    }

    private Mono<AuditEvent> buildEvent(AuditEntry entry, ServerWebExchange exchange, AuditActor actor,
                                        String sessionId) {
        return nameOf(actor)
                .map(name -> event(entry, exchange, actor, sessionId, name))
                .switchIfEmpty(Mono.fromSupplier(() -> event(entry, exchange, actor, sessionId, null)));
    }

    private AuditEvent event(AuditEntry entry, ServerWebExchange exchange, AuditActor actor, String sessionId,
                             String actorName) {
        ServerHttpRequest request = exchange.getRequest();
        return AuditEvent.builder()
                .id(AuditEvent.newId())
                .schemaVersion(AuditEvent.SCHEMA_VERSION)
                .occurredAt(Instant.now())
                .action(entry.getAction().getName())
                .outcome(entry.getOutcome())
                .reason(entry.getReason())
                .actorType(actor.type())
                .actorId(actor.id())
                .actorName(actorName)
                .actorEmail(actor.email())
                .roleSnapshot(actor.roles())
                .originTool(entry.getOriginTool())
                .sourceIp(request.getHeaders().getFirst(CLIENT_IP_HEADER))
                .userAgent(request.getHeaders().getFirst(HttpHeaders.USER_AGENT))
                .sessionId(sessionId)
                .correlationId(request.getHeaders().getFirst(REQUEST_ID_HEADER))
                .parentEventId(entry.getParentEventId())
                .tenantId(tenantOf(entry, actor, request))
                .organizationId(entry.getOrganizationId())
                .deviceId(entry.getDeviceId())
                .targetType(Objects.requireNonNullElse(entry.getTargetType(), entry.getAction().getTargetType()))
                .targetId(entry.getTargetId())
                .targetName(entry.getTargetName())
                .details(entry.getDetails())
                .changes(entry.getChanges())
                .build();
    }

    private AuditActor actorOf(Jwt jwt) {
        AuthPrincipal principal = AuthPrincipal.fromJwt(jwt);
        return AuditActor.fromToken(principal.getRoles(), principal.getId(), principal.getEmail(),
                principal.getTenantId(), principal.getMachineId(), superTenantId);
    }

    private Mono<String> nameOf(AuditActor actor) {
        if (actor.isPerson()) {
            return userRepository.findById(actor.id()).map(ReactiveAuditRecorder::fullName);
        }
        if (actor.type() == AuditActorType.DEVICE) {
            return machineRepository.findByMachineId(actor.id()).map(Machine::getHostname);
        }
        return Mono.empty();
    }

    private String tenantOf(AuditEntry entry, AuditActor actor, ServerHttpRequest request) {
        if (StringUtils.hasText(entry.getTenantId())) {
            return entry.getTenantId();
        }
        String tokenTenantId = actor.tokenTenantId();
        if (StringUtils.hasText(tokenTenantId) && !superTenantId.equals(tokenTenantId)) {
            return tokenTenantId;
        }
        return Objects.requireNonNullElse(TenantRoutingHeaders.tenantId(request), superTenantId);
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

    private static String fullName(User user) {
        return Stream.of(user.getFirstName(), user.getLastName())
                .filter(StringUtils::hasText)
                .collect(joining(" "));
    }

    private static Mono<Jwt> currentJwt() {
        return ReactiveSecurityContextHolder.getContext()
                .map(SecurityContext::getAuthentication)
                .filter(JwtAuthenticationToken.class::isInstance)
                .cast(JwtAuthenticationToken.class)
                .map(JwtAuthenticationToken::getToken);
    }
}
