package com.openframe.authz.service.sso;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

/**
 * Link-first identity resolution for SSO logins. A link binds a provider's stable subject to a
 * user; once written (by a trusted first association) it outranks email matching entirely — the
 * subject cannot be forged by a hostile directory, and it survives provider-side email changes
 * and unverifiable-domain setups alike.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SsoIdentityService {

    private static final String MICROSOFT = "microsoft";

    private final SsoIdentityRepository ssoIdentityRepository;

    /**
     * Provider-stable subject. Microsoft's {@code sub} is pairwise per app registration and
     * changes when the app is rotated, so {@code tid:oid} is used instead; Google and Apple
     * subjects are stable as issued.
     */
    public Optional<String> subjectOf(String provider, Map<String, Object> claims) {
        if (MICROSOFT.equals(provider)) {
            Object tid = claims.get("tid");
            Object oid = claims.get("oid");
            if (tid instanceof String t && hasText(t) && oid instanceof String o && hasText(o)) {
                return Optional.of(t + ":" + o);
            }
            return Optional.empty();
        }
        Object sub = claims.get("sub");
        return sub instanceof String s && hasText(s) ? Optional.of(s) : Optional.empty();
    }

    public Optional<SsoIdentity> findLink(String provider, Map<String, Object> claims) {
        return subjectOf(provider, claims)
                .flatMap(subject -> ssoIdentityRepository.findByProviderAndSubject(provider, subject));
    }

    /**
     * Writes or refreshes the link after a successful, trusted resolution. Best-effort by
     * contract: a failure here must never fail the login that just succeeded. If the subject is
     * already bound to a DIFFERENT user, the existing link wins and the conflict is only logged —
     * re-pointing a link is an explicit lifecycle action, not a login side effect.
     */
    public void link(String provider, Map<String, Object> claims, AuthUser user) {
        try {
            Optional<String> subject = subjectOf(provider, claims);
            if (subject.isEmpty()) {
                return;
            }
            SsoIdentity existing = ssoIdentityRepository.findByProviderAndSubject(provider, subject.get()).orElse(null);
            if (existing != null) {
                if (!existing.getUserId().equals(user.getId())) {
                    log.warn("event=sso-identity-conflict provider={} subject={} linkedUser={} loginUser={}",
                            provider, subject.get(), existing.getUserId(), user.getId());
                    return;
                }
                existing.setLastSeenAt(Instant.now());
                ssoIdentityRepository.save(existing);
                return;
            }
            ssoIdentityRepository.save(SsoIdentity.builder()
                    .tenantId(user.getTenantId())
                    .userId(user.getId())
                    .provider(provider)
                    .subject(subject.get())
                    .createdAt(Instant.now())
                    .lastSeenAt(Instant.now())
                    .build());
            log.info("event=sso-identity-linked provider={} user={}", provider, user.getId());
        } catch (Exception e) {
            log.warn("Failed to write sso identity link for user {}: {}", user.getId(), e.getMessage());
        }
    }
}
