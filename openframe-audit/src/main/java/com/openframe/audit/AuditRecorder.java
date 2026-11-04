package com.openframe.audit;

import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditActorType;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.Assert;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
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
public class AuditRecorder {

    private final AuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final TenantIdProvider tenantIdProvider;
    private final ObjectMapper objectMapper;
    private final String superTenantId;

    public AuditRecorder(AuditEventRepository auditEventRepository,
                         UserRepository userRepository,
                         MachineRepository machineRepository,
                         TenantIdProvider tenantIdProvider,
                         ObjectMapper objectMapper,
                         @Value("${openframe.security.jwt.super-tenant-id}") String superTenantId) {
        this.auditEventRepository = auditEventRepository;
        this.userRepository = userRepository;
        this.machineRepository = machineRepository;
        this.tenantIdProvider = tenantIdProvider;
        this.objectMapper = objectMapper;
        this.superTenantId = superTenantId;
    }

    public void record(AuditEntry entry) {
        Assert.notNull(entry.getAction(), "action is required");
        Assert.notNull(entry.getOutcome(), "outcome is required");
        Jwt jwt = currentJwt();
        AuditActor actor = jwt == null ? AuditActor.system() : actorOf(jwt);
        HttpServletRequest request = currentRequest();
        AuditEvent event = AuditEvent.builder()
                .id(AuditEvent.newId())
                .schemaVersion(AuditEvent.SCHEMA_VERSION)
                .occurredAt(Instant.now())
                .action(entry.getAction().getName())
                .outcome(entry.getOutcome())
                .reason(entry.getReason())
                .actorType(actor.type())
                .actorId(actor.id())
                .actorName(nameOf(actor))
                .actorEmail(actor.email())
                .roleSnapshot(actor.roles())
                .originTool(entry.getOriginTool())
                .sourceIp(header(request, CLIENT_IP_HEADER))
                .userAgent(header(request, HttpHeaders.USER_AGENT))
                .sessionId(jwt == null ? null : jwt.getClaimAsString(SESSION_CLAIM))
                .correlationId(header(request, REQUEST_ID_HEADER))
                .parentEventId(entry.getParentEventId())
                .tenantId(tenantOf(entry, actor))
                .organizationId(entry.getOrganizationId())
                .deviceId(entry.getDeviceId())
                .targetType(Objects.requireNonNullElse(entry.getTargetType(), entry.getAction().getTargetType()))
                .targetId(entry.getTargetId())
                .targetName(entry.getTargetName())
                .details(entry.getDetails())
                .changes(entry.getChanges())
                .build();
        save(event);
    }

    private AuditActor actorOf(Jwt jwt) {
        AuthPrincipal principal = AuthPrincipal.fromJwt(jwt);
        return AuditActor.fromToken(principal.getRoles(), principal.getId(), principal.getEmail(),
                principal.getTenantId(), principal.getMachineId(), superTenantId);
    }

    private String nameOf(AuditActor actor) {
        if (actor.isPerson()) {
            return userRepository.findById(actor.id()).map(AuditRecorder::fullName).orElse(null);
        }
        if (actor.type() == AuditActorType.DEVICE) {
            return machineRepository.findByMachineId(actor.id()).map(Machine::getHostname).orElse(null);
        }
        return null;
    }

    private String tenantOf(AuditEntry entry, AuditActor actor) {
        if (StringUtils.hasText(entry.getTenantId())) {
            return entry.getTenantId();
        }
        String tokenTenantId = actor.tokenTenantId();
        if (StringUtils.hasText(tokenTenantId) && !superTenantId.equals(tokenTenantId)) {
            return tokenTenantId;
        }
        return tenantIdProvider.getTenantId();
    }

    private void save(AuditEvent event) {
        try {
            auditEventRepository.insert(event);
        } catch (DataAccessException e) {
            log.error("Audit event not stored: {}", asJson(event), e);
        }
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

    private static Jwt currentJwt() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication instanceof JwtAuthenticationToken token ? token.getToken() : null;
    }

    private static HttpServletRequest currentRequest() {
        return RequestContextHolder.getRequestAttributes() instanceof ServletRequestAttributes attributes
                ? attributes.getRequest() : null;
    }

    private static String header(HttpServletRequest request, String name) {
        return request == null ? null : request.getHeader(name);
    }
}
