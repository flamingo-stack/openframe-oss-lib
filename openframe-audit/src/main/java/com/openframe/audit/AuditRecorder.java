package com.openframe.audit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import com.openframe.data.service.AuditClock;
import com.openframe.data.service.AuditTenantResolver;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;

import static com.openframe.core.constants.HttpHeaders.X_API_KEY_ID;
import static com.openframe.core.constants.HttpHeaders.X_USER_ID;
import static com.openframe.data.model.audit.AuditConstants.ACTOR_ATTRIBUTE;
import static com.openframe.data.model.audit.AuditConstants.ONCE_WINDOW;
import static com.openframe.data.model.audit.AuditConstants.SESSION_CLAIM;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuditRecorder {

    private static final ThreadLocal<AuditContext> DECLARED_CONTEXT = new ThreadLocal<>();
    private static final int CACHE_MAX_ENTRIES = 10_000;

    private final ApiKeyRepository apiKeyRepository;
    private final AuditTenantResolver tenantResolver;
    private final AuditOutcomeResolver outcomeResolver;
    private final AuditEventWriter writer;
    private final AuditClock auditClock;
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;
    private final Cache<String, Set<AuditOutcome>> unresolvedFailures = Caffeine.newBuilder()
            .maximumSize(CACHE_MAX_ENTRIES)
            .build();
    private final Cache<String, Boolean> recordedOnce = Caffeine.newBuilder()
            .expireAfterWrite(ONCE_WINDOW)
            .maximumSize(CACHE_MAX_ENTRIES)
            .ticker(this::nanosNow)
            .build();

    private long nanosNow() {
        return TimeUnit.MILLISECONDS.toNanos(auditClock.now().toEpochMilli());
    }

    public AuditContext context() {
        return Objects.requireNonNullElseGet(DECLARED_CONTEXT.get(),
                () -> context(actorOf(currentJwt(), currentRequest())));
    }

    public AuditContext context(AuditActor actor) {
        AuditContext declared = DECLARED_CONTEXT.get();
        return declared == null ? new AuditContext(actor, requestInfo(), null) : declared.withActor(actor);
    }

    public String parentEventId() {
        AuditContext declared = DECLARED_CONTEXT.get();
        return declared == null ? null : declared.parentEventId();
    }

    public AuditRequestInfo requestInfo() {
        HttpServletRequest request = currentRequest();
        Jwt jwt = currentJwt();
        return AuditRequestInfo.fromHeaders(name -> header(request, name),
                jwt == null ? loginSessionId(request) : jwt.getClaimAsString(SESSION_CLAIM));
    }

    private AuditActor actorOf(AuthPrincipal principal) {
        return principal.getActorType() == ActorType.AGENT
                ? AuditActor.fromAgent(principal.getMachineId(), principal.getRoles(), principal.getTenantId())
                : AuditActor.fromUser(principal.getId(), principal.getEmail(), principal.getRoles(),
                        principal.getTenantId(), tenantResolver.superTenantId());
    }

    private AuditActor actorOf(Jwt jwt, HttpServletRequest request) {
        if (!enabled) {
            return AuditActor.system();
        }
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
        Optional<ApiKey> key = AuditEventWriter.tryFind("API key", () -> apiKeyRepository.findById(keyId));
        return AuditActor.fromApiKey(keyId, key.map(ApiKey::getName).orElse(null),
                key.map(ApiKey::getRoles).orElse(null), key.map(ApiKey::getTenantId).orElse(null),
                header(request, X_USER_ID));
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

    private static String loginSessionId(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        HttpSession session = request.getSession(false);
        return session == null ? null : Sha256.hex(session.getId());
    }

    public <R, E extends Throwable> R runInContext(AuditContext context, AuditedWork<R, E> work) throws E {
        if (context == null) {
            return work.run();
        }
        AuditContext outer = DECLARED_CONTEXT.get();
        DECLARED_CONTEXT.set(context);
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

    public void runInContext(AuditContext context, Runnable work) {
        runInContext(context, () -> {
            work.run();
            return null;
        });
    }

    public <T> Supplier<T> wrapInCurrentContext(Supplier<T> work) {
        AuditContext context = context();
        return () -> runInContext(context, work::get);
    }

    public boolean record(AuditEntry entry) {
        return write(List.of(entry), this::context, true);
    }

    public boolean record(AuditEntry entry, AuditActor actor) {
        return write(List.of(entry), () -> context(actor), true);
    }

    public boolean record(AuditEntry entry, AuditContext context) {
        return write(List.of(entry), () -> context, true);
    }

    public void recordOnce(AuditEntry.AuditEntryBuilder entry, Throwable failure, String key) {
        try {
            if (recordOnce(failed(entry, failure), key)) {
                RecordedFailures.add(failure);
            }
        } catch (RuntimeException e) {
            log.error("Audit event of a failure not recorded", e);
        }
    }

    public boolean recordOnce(AuditEntry entry, String key) {
        entry.requireOutcome();
        try {
            AuditContext context = context();
            AuditActor actor = context.actor();
            String onceKey = String.join(":", entry.getAction().getName(), entry.getOutcome().name(), key,
                    tenantResolver.tenantFor(actor, entry.getTenantId()), actor.identity());
            Boolean firstStored = recordedOnce.asMap().putIfAbsent(onceKey, true);
            if (firstStored != null) {
                return firstStored;
            }
            boolean stored = false;
            try {
                stored = record(entry, context);
            } finally {
                if (!stored) {
                    recordedOnce.put(onceKey, false);
                }
            }
            return stored;
        } catch (RuntimeException e) {
            log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
            return false;
        }
    }

    public void recordAll(List<AuditEntry> entries) {
        write(entries, this::context, true);
    }

    public void recordAllWithoutLoadingTargets(List<AuditEntry> entries) {
        write(entries, this::context, false);
    }

    boolean recordAudited(AuditEntry entry, AuditContext context) {
        return write(List.of(entry), () -> context, false);
    }

    private boolean write(List<AuditEntry> entries, Supplier<AuditContext> context, boolean loadTarget) {
        entries.forEach(AuditEntry::requireOutcome);
        if (!enabled || entries.isEmpty()) {
            return false;
        }
        try {
            return writer.write(entries, context.get(), loadTarget);
        } catch (RuntimeException e) {
            log.error("Audit events not recorded: {}", entries, e);
            return false;
        }
    }

    public void recordFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure) {
        try {
            if (record(failed(entry, failure))) {
                RecordedFailures.add(failure);
            }
        } catch (RuntimeException e) {
            log.error("Audit event of a failure not recorded", e);
        }
    }

    public void recordUnresolvedFailure(AuditEntry entry, String key) {
        entry.requireOutcome();
        Set<AuditOutcome> recordedOutcomes = unresolvedFailures.get(failureKey(entry.getAction(), key),
                _ -> ConcurrentHashMap.newKeySet());
        if (!recordedOutcomes.add(entry.getOutcome())) {
            return;
        }
        boolean stored = false;
        try {
            stored = record(entry);
        } finally {
            if (!stored) {
                recordedOutcomes.remove(entry.getOutcome());
            }
        }
    }

    public void recordUnresolvedFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure, String key) {
        try {
            recordUnresolvedFailure(failed(entry, failure), key);
        } catch (RuntimeException e) {
            log.error("Audit event of a failure not recorded", e);
        }
    }

    public void failureResolved(AuditAction action, String key) {
        unresolvedFailures.invalidate(failureKey(action, key));
    }

    private AuditEntry failed(AuditEntry.AuditEntryBuilder entry, Throwable failure) {
        ActionOutcome outcome = outcomeResolver.ofFailure(failure);
        return entry.outcome(outcome.outcome()).reason(outcome.reason()).build();
    }

    private static String failureKey(AuditAction action, String key) {
        return action.getName() + ":" + key;
    }
}
