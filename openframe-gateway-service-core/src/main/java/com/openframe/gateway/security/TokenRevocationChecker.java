package com.openframe.gateway.security;

import com.github.benmanes.caffeine.cache.AsyncCache;
import com.github.benmanes.caffeine.cache.Caffeine;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.document.user.User;
import com.openframe.data.document.user.UserStatus;
import com.openframe.data.reactive.repository.device.ReactiveMachineRepository;
import com.openframe.data.reactive.repository.tenant.ReactiveTenantRepository;
import com.openframe.data.reactive.repository.user.ReactiveUserRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException;
import org.springframework.stereotype.Component;
import reactor.core.publisher.Mono;

import java.time.Duration;
import java.time.Instant;
import java.util.function.Supplier;

import static org.springframework.util.StringUtils.hasText;

/**
 * Rejects an access token whose subject was revoked after the token was issued.
 * <p>
 * Access tokens are self-contained JWTs: signature and expiry alone keep a token working until it
 * expires, up to 15 minutes for a user and an hour for a device, whatever the auth server revoked
 * meanwhile. This looks the subject up in Mongo, which the shared and the tenant services both write
 * to, and rejects the token when:
 * <ul>
 *   <li>the user is no longer {@link UserStatus#ACTIVE}, or the token was issued before the user's
 *       {@link User#getTokensRevokedAt() tokensRevokedAt};</li>
 *   <li>the device is {@link DeviceStatus#DELETED}, or the token was issued before the device's
 *       {@link Machine#getTokensRevokedAt() tokensRevokedAt}. A device pending deletion stays
 *       allowed: the uninstall is the one command it is still waiting for;</li>
 *   <li>the subject's tenant is {@link TenantStatus#BLOCKED} or {@link TenantStatus#DELETED}. A
 *       user's tenant comes from the token, a device's from its machine record, as device tokens
 *       name no tenant. An unblock lets the tenant's tokens through again within {@code cache-ttl}.</li>
 * </ul>
 * Lookups are cached per subject, so a revocation lands within {@code cache-ttl}. A subject that is
 * not found, or a lookup that fails, lets the token through: only positive evidence rejects, so an
 * outage of this check cannot log everyone out.
 */
@Slf4j
@Component
public class TokenRevocationChecker {

    static final String USER_ID_CLAIM = "userId";
    static final String TENANT_ID_CLAIM = "tenant_id";
    static final String MACHINE_ID_CLAIM = "machine_id";

    private final ReactiveUserRepository userRepository;
    private final ReactiveMachineRepository machineRepository;
    private final ReactiveTenantRepository tenantRepository;
    private final boolean enabled;
    private final AsyncCache<String, SubjectState> states;

    public TokenRevocationChecker(ReactiveUserRepository userRepository,
                                  ReactiveMachineRepository machineRepository,
                                  ReactiveTenantRepository tenantRepository,
                                  @Value("${openframe.gateway.token-revocation.enabled:false}") boolean enabled,
                                  @Value("${openframe.gateway.token-revocation.cache-ttl:10s}") Duration cacheTtl,
                                  @Value("${openframe.gateway.token-revocation.cache-max-size:100000}") long cacheMaxSize) {
        this.userRepository = userRepository;
        this.machineRepository = machineRepository;
        this.tenantRepository = tenantRepository;
        this.enabled = enabled;
        this.states = Caffeine.newBuilder()
                .expireAfterWrite(cacheTtl)
                .maximumSize(cacheMaxSize)
                .buildAsync();
    }

    /**
     * Completes empty when the token may be used, and with an {@link InvalidBearerTokenException}
     * (answered as 401) when its subject was revoked. Tokens with neither a user nor a machine
     * claim pass unchecked.
     */
    public Mono<Void> verify(Jwt jwt) {
        if (!enabled) {
            return Mono.empty();
        }
        String userId = jwt.getClaimAsString(USER_ID_CLAIM);
        if (hasText(userId)) {
            return verifyUser(jwt, userId);
        }
        String machineId = jwt.getClaimAsString(MACHINE_ID_CLAIM);
        if (hasText(machineId)) {
            return verifyMachine(jwt, machineId);
        }
        return Mono.empty();
    }

    private Mono<Void> verifyUser(Jwt jwt, String userId) {
        String tenantId = jwt.getClaimAsString(TENANT_ID_CLAIM);
        return state("user:" + tenantId + ":" + userId, () -> findUser(tenantId, userId).map(SubjectState::of))
                .flatMap(state -> rejectIfRevoked(state, jwt, "user " + userId))
                .then(verifyTenant(jwt, tenantId, "user " + userId));
    }

    private Mono<Void> verifyMachine(Jwt jwt, String machineId) {
        String subject = "machine " + machineId;
        return state("machine:" + machineId, () -> machineRepository.findByMachineId(machineId).map(SubjectState::of))
                .flatMap(state -> rejectIfRevoked(state, jwt, subject).then(verifyTenant(jwt, state.tenantId(), subject)));
    }

    private Mono<Void> verifyTenant(Jwt jwt, String tenantId, String subject) {
        if (!hasText(tenantId)) {
            return Mono.empty();
        }
        return state("tenant:" + tenantId, () -> tenantRepository.findById(tenantId).map(SubjectState::of))
                .flatMap(state -> rejectIfRevoked(state, jwt, subject + " of tenant " + tenantId));
    }

    /**
     * The tenant-first lookup when the token names a tenant: the shared side bypasses the tenant
     * aspect, so a bare id lookup would not be scoped.
     */
    private Mono<User> findUser(String tenantId, String userId) {
        return hasText(tenantId)
                ? userRepository.findByTenantIdAndId(tenantId, userId)
                : userRepository.findById(userId);
    }

    /**
     * One lookup per subject per cache window, shared by concurrent requests. A failed lookup is not
     * cached, so the next request tries again.
     */
    private Mono<SubjectState> state(String key, Supplier<Mono<SubjectState>> lookup) {
        return Mono.deferContextual(context -> Mono.fromFuture(
                        () -> states.get(key, (k, executor) -> lookup.get()
                                .defaultIfEmpty(SubjectState.UNKNOWN)
                                .contextWrite(context)
                                .toFuture()),
                        true))
                .onErrorResume(failure -> {
                    log.warn("Token revocation lookup failed for {}, token allowed", key, failure);
                    return Mono.just(SubjectState.UNKNOWN);
                });
    }

    private static Mono<Void> rejectIfRevoked(SubjectState state, Jwt jwt, String subject) {
        if (!state.rejects(jwt.getIssuedAt())) {
            return Mono.empty();
        }
        log.info("Rejected a revoked access token of {} issued at {}", subject, jwt.getIssuedAt());
        return Mono.error(new InvalidBearerTokenException("Token has been revoked"));
    }

    /**
     * What a lookup found about a token's subject.
     *
     * @param removed       the subject may not use any token
     * @param revokedBefore tokens issued before this instant are rejected; null when none are
     * @param tenantId      the tenant a device belongs to, whose status is checked next; null otherwise
     */
    record SubjectState(boolean removed, Instant revokedBefore, String tenantId) {

        static final SubjectState UNKNOWN = new SubjectState(false, null, null);

        static SubjectState of(User user) {
            return new SubjectState(user.getStatus() != UserStatus.ACTIVE, user.getTokensRevokedAt(), null);
        }

        static SubjectState of(Machine machine) {
            return new SubjectState(machine.getStatus() == DeviceStatus.DELETED, machine.getTokensRevokedAt(),
                    machine.getTenantId());
        }

        static SubjectState of(Tenant tenant) {
            TenantStatus status = tenant.getStatus();
            return new SubjectState(status == TenantStatus.BLOCKED || status == TenantStatus.DELETED, null, null);
        }

        /**
         * A token without {@code iat} cannot be placed before or after a revocation, so only
         * {@code removed} applies to it.
         */
        boolean rejects(Instant issuedAt) {
            if (removed) {
                return true;
            }
            return revokedBefore != null && issuedAt != null && issuedAt.isBefore(revokedBefore);
        }
    }
}
