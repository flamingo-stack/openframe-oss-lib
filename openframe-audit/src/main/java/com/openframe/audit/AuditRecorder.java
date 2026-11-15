package com.openframe.audit;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.core.util.Sha256;
import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.document.audit.AuditAction;
import com.openframe.data.model.audit.AuditActor;
import com.openframe.data.model.audit.AuditEntry;
import com.openframe.data.model.audit.AuditRequestInfo;
import com.openframe.data.repository.apikey.ApiKeyRepository;
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
    @Value("${openframe.audit.enabled}")
    private final boolean enabled;
    private final Cache<String, Boolean> unresolvedFailures = Caffeine.newBuilder()
            .maximumSize(CACHE_MAX_ENTRIES)
            .build();
    private final Cache<String, Boolean> recordedOnce = Caffeine.newBuilder()
            .expireAfterWrite(ONCE_WINDOW)
            .maximumSize(CACHE_MAX_ENTRIES)
            .build();

    public AuditContext context() {
        return Objects.requireNonNullElseGet(DECLARED_CONTEXT.get(),
                () -> context(actorOf(currentJwt(), currentRequest())));
    }

    public AuditContext context(AuditActor actor) {
        AuditContext declared = DECLARED_CONTEXT.get();
        return declared == null
                ? new AuditContext(actor, requestInfo(), null)
                : new AuditContext(actor, declared.requestInfo(), declared.parentEventId());
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

    public AuditActor actorOf(AuthPrincipal principal) {
        return principal.getActorType() == ActorType.AGENT
                ? AuditActor.fromAgent(principal.getMachineId(), principal.getRoles(), principal.getTenantId())
                : AuditActor.fromUser(principal.getId(), principal.getEmail(), principal.getRoles(),
                        principal.getTenantId(), tenantResolver.superTenantId());
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
        AuditContext outer = DECLARED_CONTEXT.get();
        DECLARED_CONTEXT.set(addParentEventId(context));
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

    private AuditContext addParentEventId(AuditContext context) {
        String parentEventId = parentEventId();
        return context != null && context.parentEventId() == null && parentEventId != null
                ? context.withParentEventId(parentEventId)
                : context;
    }

    public boolean record(AuditEntry entry) {
        return write(List.of(entry), null, true);
    }

    public boolean record(AuditEntry entry, AuditActor actor) {
        return record(entry, context(actor));
    }

    public boolean record(AuditEntry entry, AuditContext context) {
        return write(List.of(entry), context, true);
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
                    tenantResolver.tenantFor(actor, entry.getTenantId()), actor.id());
            if (recordedOnce.asMap().putIfAbsent(onceKey, Boolean.TRUE) == null) {
                record(entry, context);
            }
        } catch (RuntimeException e) {
            log.error("Audit event not recorded for {}", entry.getAction().getName(), e);
        }
    }

    public void recordAll(List<AuditEntry> entries) {
        write(entries, null, true);
    }

    boolean recordCaptured(AuditEntry entry, AuditContext context) {
        return write(List.of(entry), context, false);
    }

    private boolean write(List<AuditEntry> entries, AuditContext context, boolean loadTarget) {
        entries.forEach(AuditEntry::requireOutcome);
        if (!enabled || entries.isEmpty()) {
            return false;
        }
        try {
            AuditContext contextToUse = context == null ? context() : addParentEventId(context);
            return writer.write(entries, contextToUse, loadTarget);
        } catch (RuntimeException e) {
            log.error("Audit events not recorded: {}", entries, e);
            return false;
        }
    }

    public void recordFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure) {
        record(failed(entry, failure));
    }

    public void recordUnresolvedFailure(AuditEntry entry, String key) {
        String failureKey = failureKey(entry.getAction(), key);
        if (unresolvedFailures.asMap().putIfAbsent(failureKey, Boolean.TRUE) != null) {
            return;
        }
        if (!record(entry)) {
            unresolvedFailures.invalidate(failureKey);
        }
    }

    public void recordUnresolvedFailure(AuditEntry.AuditEntryBuilder entry, Throwable failure, String key) {
        recordUnresolvedFailure(failed(entry, failure), key);
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
