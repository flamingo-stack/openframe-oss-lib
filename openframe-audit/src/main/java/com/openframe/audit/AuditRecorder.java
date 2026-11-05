package com.openframe.audit;

import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditActor;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditEvent;
import com.openframe.data.document.audit.AuditSource;
import com.openframe.data.document.audit.AuditTargetType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.user.User;
import com.openframe.data.mapper.AuditEventMapper;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.repository.audit.AuditEventRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.data.service.AuditTenants;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
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

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.document.audit.AuditActorType.FAE;
import static com.openframe.data.document.audit.AuditRequestContext.ACTOR_ATTRIBUTE;
import static com.openframe.data.document.audit.AuditRequestContext.CLIENT_IP_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.REQUEST_ID_HEADER;
import static com.openframe.data.document.audit.AuditRequestContext.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditRecorder {

    private static final ThreadLocal<AuditContext> DECLARED_CONTEXT = new ThreadLocal<>();

    private final AuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final AuditTenants auditTenants;
    private final AuditTargets targets;
    private final AuditEventMapper auditEventMapper;
    private final ObjectMapper objectMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;

    public AuditContext context() {
        return Objects.requireNonNullElseGet(DECLARED_CONTEXT.get(),
                () -> context(actorOf(currentJwt(), currentRequest())));
    }

    public AuditContext context(AuditActor actor) {
        AuditContext declared = DECLARED_CONTEXT.get();
        return declared == null
                ? new AuditContext(actor, source(), null)
                : new AuditContext(actor, declared.source(), declared.parentEventId());
    }

    public String currentEventId() {
        AuditContext declared = DECLARED_CONTEXT.get();
        return declared == null ? null : declared.parentEventId();
    }

    public AuditSource source() {
        HttpServletRequest request = currentRequest();
        Jwt jwt = currentJwt();
        return new AuditSource(header(request, CLIENT_IP_HEADER), header(request, HttpHeaders.USER_AGENT),
                header(request, REQUEST_ID_HEADER), jwt == null ? null : jwt.getClaimAsString(SESSION_CLAIM));
    }

    public <R, E extends Throwable> R within(AuditContext context, AuditedWork<R, E> work) throws E {
        AuditContext outer = DECLARED_CONTEXT.get();
        DECLARED_CONTEXT.set(underCurrentEvent(context));
        try {
            return work.run();
        } finally {
            if (outer == null) {
                DECLARED_CONTEXT.remove();
            } else {
                DECLARED_CONTEXT.set(outer);
            }
        }
    }

    public void within(AuditContext context, Runnable work) {
        within(context, () -> {
            work.run();
            return null;
        });
    }

    public <T> Supplier<T> inCurrentContext(Supplier<T> work) {
        AuditContext context = context();
        return () -> within(context, work::get);
    }

    public AuditActor userActor(String userId, String email, List<String> roles, String tenantId) {
        return AuditActor.fromUser(userId, email, roles, tenantId, auditTenants.superTenantId());
    }

    public AuditActor actorOf(AuthPrincipal principal) {
        return principal.getActorType() == ActorType.AGENT
                ? AuditActor.fromAgent(principal.getMachineId(), principal.getRoles(), principal.getTenantId())
                : AuditActor.fromUser(principal.getId(), principal.getEmail(), principal.getRoles(),
                        principal.getTenantId(), auditTenants.superTenantId());
    }

    public String record(AuditEntry entry) {
        return record(entry, (AuditContext) null);
    }

    public String record(AuditEntry entry, AuditActor actor) {
        return record(entry, context(actor));
    }

    public String record(AuditEntry entry, AuditContext context) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        if (!enabled) {
            return null;
        }
        try {
            AuditContext given = context == null ? context() : underCurrentEvent(context);
            return save(eventOf(entry, given));
        } catch (RuntimeException e) {
            log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
            return null;
        }
    }

    private AuditContext underCurrentEvent(AuditContext context) {
        String currentEventId = currentEventId();
        return context != null && context.parentEventId() == null && currentEventId != null
                ? context.withParentEventId(currentEventId)
                : context;
    }

    public String targetIdOf(AuditTargetType targetType, String targetId) {
        return targetId == null && targetType == AuditTargetType.TENANT ? auditTenants.servedTenantId() : targetId;
    }

    private AuditEvent eventOf(AuditEntry entry, AuditContext context) {
        AuditActor actor = context.actor();
        String tenantId = auditTenants.tenantFor(actor, entry.getTenantId());
        AuditTargetType targetType = Objects.requireNonNullElse(entry.getTargetType(), entry.getAction().getTargetType());
        String targetId = targetIdOf(targetType, entry.getTargetId());
        boolean secretId = targets.find(targetType).stream().anyMatch(AuditTarget::secretId);
        AuditEntry stored = entry.toBuilder()
                .targetType(targetType)
                .targetId(secretId && targetId != null ? Sha256.hex(targetId) : targetId)
                .build();
        AuditEvent event = auditEventMapper.toEvent(stored, actor, context.source(), tenantId, context.parentEventId());
        event.setActorName(nameOf(actor));
        event.setOnBehalfOfName(onBehalfOfNameOf(actor));
        event.setApproverName(actor.approver() == null ? null : nameOf(actor.approver()));
        return event;
    }

    private AuditActor actorOf(Jwt jwt, HttpServletRequest request) {
        if (request != null && request.getAttribute(ACTOR_ATTRIBUTE) instanceof AuditActor declared) {
            return declared;
        }
        if (jwt != null) {
            return actorOf(AuthPrincipal.fromJwt(jwt));
        }
        String keyId = header(request, X_API_KEY_ID);
        if (!StringUtils.hasText(keyId)) {
            return AuditActor.system();
        }
        Optional<ApiKey> key = lookup(() -> apiKeyRepository.findById(keyId));
        return AuditActor.fromApiKey(keyId, key.map(ApiKey::getName).orElse(null),
                key.map(ApiKey::getRoles).orElse(null), key.map(ApiKey::getTenantId).orElse(null),
                header(request, X_USER_ID));
    }

    private String nameOf(AuditActor actor) {
        if (actor.name() != null) {
            return actor.name();
        }
        if (actor.id() == null) {
            return null;
        }
        return switch (actor.type()) {
            case USER, STAFF -> userNameOf(actor.id());
            case DEVICE -> hostnameOf(actor.id());
            default -> null;
        };
    }

    private String onBehalfOfNameOf(AuditActor actor) {
        if (actor.onBehalfOfId() == null) {
            return null;
        }
        return actor.type() == FAE ? hostnameOf(actor.onBehalfOfId()) : userNameOf(actor.onBehalfOfId());
    }

    private String userNameOf(String userId) {
        return lookup(() -> userRepository.findById(userId)).map(User::fullName).orElse(null);
    }

    private String hostnameOf(String machineId) {
        return lookup(() -> machineRepository.findByMachineId(machineId)).map(Machine::getHostname).orElse(null);
    }

    private String save(AuditEvent event) {
        try {
            return auditEventRepository.insert(event).getId();
        } catch (DataAccessException e) {
            log.error("Audit event not stored: {}", asJson(event), e);
            return null;
        }
    }

    private String asJson(AuditEvent event) {
        try {
            return objectMapper.writeValueAsString(event);
        } catch (JacksonException e) {
            return event.toString();
        }
    }

    private static <T> Optional<T> lookup(Supplier<Optional<T>> query) {
        try {
            return query.get();
        } catch (DataAccessException e) {
            log.error("Audit lookup failed, the event is stored without its result", e);
            return Optional.empty();
        }
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
