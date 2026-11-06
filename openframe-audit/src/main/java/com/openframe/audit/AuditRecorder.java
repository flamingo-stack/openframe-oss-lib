package com.openframe.audit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.audit.targets.AuditTarget;
import com.openframe.audit.targets.AuditTargetRepository;
import com.openframe.audit.targets.AuditTargets;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
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
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataAccessException;
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

import java.time.Duration;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.WeakHashMap;
import java.util.function.Supplier;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.document.audit.AuditActorType.FAE;
import static com.openframe.data.document.audit.AuditRequestContext.ACTOR_ATTRIBUTE;
import static com.openframe.data.document.audit.AuditRequestContext.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditRecorder {

    private static final ThreadLocal<AuditContext> DECLARED_CONTEXT = new ThreadLocal<>();
    private static final ThreadLocal<Boolean> CAPTURING = new ThreadLocal<>();
    private static final Set<Throwable> CAPTURED_FAILURES =
            Collections.synchronizedSet(Collections.newSetFromMap(new WeakHashMap<>()));
    private static final Duration ONCE_WINDOW = Duration.ofMinutes(1);
    private static final int ONCE_KEYS = 10_000;

    private final AuditEventRepository auditEventRepository;
    private final UserRepository userRepository;
    private final MachineRepository machineRepository;
    private final ApiKeyRepository apiKeyRepository;
    private final AuditTenants auditTenants;
    private final AuditTargets targets;
    private final AuditTargetRepository targetRepository;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditEventMapper auditEventMapper;
    private final ObjectMapper objectMapper;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;
    private final Cache<String, Boolean> unresolvedFailures = Caffeine.newBuilder()
            .maximumSize(ONCE_KEYS)
            .build();
    private final Cache<String, Boolean> recordedOnce = Caffeine.newBuilder()
            .expireAfterWrite(ONCE_WINDOW)
            .maximumSize(ONCE_KEYS)
            .build();

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
        return AuditSource.fromHeaders(name -> header(request, name),
                jwt == null ? loginSessionId(request) : jwt.getClaimAsString(SESSION_CLAIM));
    }

    private static String loginSessionId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        HttpSession session = request.getSession(false);
        return session == null ? null : Sha256.hex(session.getId());
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

    <R, E extends Throwable> R capturing(AuditContext context, AuditedWork<R, E> work) throws E {
        boolean outermost = CAPTURING.get() == null;
        CAPTURING.set(Boolean.TRUE);
        try {
            return within(context, work);
        } finally {
            if (outermost) {
                CAPTURING.remove();
            }
        }
    }

    void markCaptured(Throwable failure) {
        CAPTURED_FAILURES.add(failure);
    }

    public boolean captured(Throwable failure) {
        return CAPTURED_FAILURES.contains(failure)
                || failure.getCause() != null && CAPTURED_FAILURES.contains(failure.getCause());
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
        return write(entry, context, true);
    }

    String recordCaptured(AuditEntry entry, AuditContext context) {
        return write(entry, context, false);
    }

    public void recordFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure) {
        record(failed(entry, failure));
    }

    public void recordUnresolvedFailure(AuditEntry entry, String condition) {
        String key = conditionKey(entry.getAction(), condition);
        if (!enabled || unresolvedFailures.asMap().putIfAbsent(key, Boolean.TRUE) != null) {
            return;
        }
        if (record(entry) == null) {
            unresolvedFailures.invalidate(key);
        }
    }

    public void recordUnresolvedFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure, String condition) {
        recordUnresolvedFailure(failed(entry, failure), condition);
    }

    public void failureResolved(AuditAction action, String condition) {
        unresolvedFailures.invalidate(conditionKey(action, condition));
    }

    private static String conditionKey(AuditAction action, String condition) {
        return action.getName() + ":" + condition;
    }

    private AuditEntry failed(AuditEntry.AuditEntryBuilder entry, Throwable failure) {
        ActionOutcome outcome = outcomeResolver.ofFailure(failure);
        return entry.outcome(outcome.outcome()).reason(outcome.reason()).build();
    }

    private String write(AuditEntry entry, AuditContext context, boolean loadTarget) {
        Assert.state(entry.getAction() != null, "An audit entry needs an action");
        Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        if (!enabled) {
            return null;
        }
        if (targetTypeOf(entry) == null) {
            log.error("Audit skipped: {} has no fixed target type, so the entry must name one",
                    entry.getAction().getName());
            return null;
        }
        try {
            AuditContext given = context == null ? context() : underCurrentEvent(context);
            AuditEntry complete = loadTarget ? withTargetFields(entry) : entry;
            return save(eventOf(complete, given, namesOf(given.actor())));
        } catch (RuntimeException e) {
            log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
            return null;
        }
    }

    public void recordUnlessCaptured(AuditEntry entry) {
        if (CAPTURING.get() == null) {
            record(entry);
        }
    }

    public void recordOnceUnlessCaptured(AuditEntry entry, String key) {
        if (CAPTURING.get() == null) {
            recordOnce(entry, key);
        }
    }

    public String currentEndpoint() {
        HttpServletRequest request = currentRequest();
        return request == null ? null : request.getMethod() + " " + request.getRequestURI();
    }

    public void recordOnce(AuditEntry entry, String key) {
        recordOnce(entry, key, this::context);
    }

    public void recordOnce(AuditEntry entry, String key, AuditActor actor) {
        recordOnce(entry, key, () -> context(actor));
    }

    private void recordOnce(AuditEntry entry, String key, Supplier<AuditContext> contextOf) {
        if (!enabled) {
            return;
        }
        try {
            AuditContext context = contextOf.get();
            AuditActor actor = context.actor();
            String onceKey = String.join(":", entry.getAction().getName(), key,
                    Objects.requireNonNullElse(auditTenants.tenantFor(actor, entry.getTenantId()), "-"),
                    Objects.requireNonNullElse(actor.id(), "-"));
            if (recordedOnce.asMap().putIfAbsent(onceKey, Boolean.TRUE) == null) {
                record(entry, context);
            }
        } catch (RuntimeException e) {
            log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
        }
    }

    public void recordAll(List<AuditEntry> entries) {
        entries.forEach(entry -> {
            Assert.state(entry.getAction() != null, "An audit entry needs an action");
            Assert.state(entry.getOutcome() != null, "An audit entry needs an outcome");
        });
        if (!enabled || entries.isEmpty()) {
            return;
        }
        List<AuditEvent> events = List.of();
        try {
            AuditContext context = context();
            ActorNames names = namesOf(context.actor());
            events = entries.stream().map(entry -> eventOf(withTargetFields(entry), context, names)).toList();
            auditEventRepository.insert(events);
        } catch (RuntimeException e) {
            String dropped = events.isEmpty()
                    ? entries.toString()
                    : events.stream().map(this::asJson).toList().toString();
            log.error("Audit events not recorded: {}", dropped, e);
        }
    }

    private record ActorNames(String actor, String onBehalfOf, String approver) {
    }

    private ActorNames namesOf(AuditActor actor) {
        return new ActorNames(nameOf(actor), onBehalfOfNameOf(actor),
                actor.approver() == null ? null : nameOf(actor.approver()));
    }

    private AuditContext underCurrentEvent(AuditContext context) {
        String currentEventId = currentEventId();
        return context != null && context.parentEventId() == null && currentEventId != null
                ? context.withParentEventId(currentEventId)
                : context;
    }

    public String targetIdOf(AuditTargetType targetType, String targetId) {
        if (targetId != null) {
            return targetId;
        }
        boolean keyedByTenant = targetType == AuditTargetType.TENANT
                || targets.find(targetType).stream().anyMatch(AuditTarget::keyedByTenant);
        return keyedByTenant ? auditTenants.isolatedTenantId() : null;
    }

    private AuditEntry withTargetFields(AuditEntry entry) {
        boolean complete = entry.getTargetName() != null && entry.getOrganizationId() != null
                && entry.getDeviceId() != null;
        AuditTargetType targetType = targetTypeOf(entry);
        String targetId = targetIdOf(targetType, entry.getTargetId());
        if (complete || targetType == null || targetId == null) {
            return entry;
        }
        try {
            return targetRepository.load(targets.find(targetType), targetId)
                    .map(loaded -> entry.toBuilder()
                            .targetName(firstNonNull(entry.getTargetName(), loaded.name()))
                            .organizationId(firstNonNull(entry.getOrganizationId(), loaded.organizationId()))
                            .deviceId(firstNonNull(entry.getDeviceId(), loaded.deviceId()))
                            .build())
                    .orElse(entry);
        } catch (RuntimeException e) {
            log.error("Audit target {} not read, {} is stored without its name", targetId,
                    entry.getAction().getName(), e);
            return entry;
        }
    }

    private static AuditTargetType targetTypeOf(AuditEntry entry) {
        return entry.getTargetType() != null ? entry.getTargetType() : entry.getAction().getTargetType();
    }

    private static String firstNonNull(String value, String fallback) {
        return value != null ? value : fallback;
    }

    private AuditEvent eventOf(AuditEntry entry, AuditContext context, ActorNames names) {
        AuditActor actor = context.actor();
        String tenantId = auditTenants.tenantFor(actor, entry.getTenantId());
        AuditTargetType targetType = targetTypeOf(entry);
        String targetId = targetIdOf(targetType, entry.getTargetId());
        boolean secretId = targets.find(targetType).stream().anyMatch(AuditTarget::secretId);
        AuditEntry stored = entry.toBuilder()
                .targetType(targetType)
                .targetId(secretId && targetId != null ? Sha256.hex(targetId) : targetId)
                .build();
        AuditEvent event = auditEventMapper.toEvent(stored, actor, context.source(), tenantId, context.parentEventId());
        event.setActorName(names.actor());
        event.setOnBehalfOfName(names.onBehalfOf());
        event.setApproverName(names.approver());
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
