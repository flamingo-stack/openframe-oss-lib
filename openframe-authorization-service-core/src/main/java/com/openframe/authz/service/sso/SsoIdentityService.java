package com.openframe.authz.service.sso;

import com.openframe.data.document.auth.AuthUser;
import com.openframe.data.document.auth.SsoIdentity;
import com.openframe.data.repository.auth.SsoIdentityRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;

import static com.openframe.authz.config.oidc.MicrosoftSSOProperties.MICROSOFT;
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

    private final SsoIdentityRepository ssoIdentityRepository;
    private final MongoTemplate mongoTemplate;

    /**
     * Provider-stable subject. Microsoft's {@code sub} is pairwise per app registration and
     * changes when the app is rotated, so {@code tid:oid} is used instead; Google and Apple
     * subjects are stable as issued.
     */
    private Optional<String> subjectOfOptional(String provider, Map<String, Object> claims) {
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

    /**
     * True when a provider-stable subject can be resolved from the given claims.
     */
    public boolean hasSubject(String provider, Map<String, Object> claims) {
        return subjectOfOptional(provider, claims).isPresent();
    }

    /**
     * Provider-stable subject, throwing if none can be resolved from the given claims.
     * Callers should check {@link #hasSubject(String, Map)} first, or rely on the exception
     * when a subject is expected to be present.
     */
    public String subjectOf(String provider, Map<String, Object> claims) {
        return subjectOfOptional(provider, claims)
                .orElseThrow(() -> new NoSuchElementException("No subject resolvable for provider " + provider));
    }

    /**
     * True when a link exists for the subject resolvable from the given claims.
     */
    public boolean hasLink(String provider, Map<String, Object> claims) {
        return subjectOfOptional(provider, claims)
                .map(subject -> hasSubjectLink(provider, subject))
                .orElse(false);
    }

    /**
     * The existing link for the subject resolvable from the given claims, throwing if either the
     * subject cannot be resolved or no link exists for it. Callers should check
     * {@link #hasLink(String, Map)} first.
     */
    public SsoIdentity findLink(String provider, Map<String, Object> claims) {
        String subject = subjectOf(provider, claims);
        return findBySubject(provider, subject);
    }

    /** Explicit lifecycle removal (cross-tenant switch, admin unlink). Not a login side effect. */
    public void removeUserLinks(String userId) {
        ssoIdentityRepository.deleteByUserId(userId);
    }

    /**
     * True when a link exists for the given provider/subject pair.
     */
    public boolean hasSubjectLink(String provider, String subject) {
        return ssoIdentityRepository.findByProviderAndSubject(provider, subject).isPresent();
    }

    /**
     * The existing link for the given provider/subject pair, throwing if none exists. Callers
     * should check {@link #hasSubjectLink(String, String)} first.
     */
    public SsoIdentity findBySubject(String provider, String subject) {
        return ssoIdentityRepository.findByProviderAndSubject(provider, subject)
                .orElseThrow(() -> new NoSuchElementException(
                        "No sso identity link found for provider " + provider + " and subject " + subject));
    }

    /**
     * Registration guard for the one-SSO-account-one-user invariant: throws when this identity is
     * already linked, so a bound subject signs in rather than spawning a second account it could
     * never reach through this provider again. The self-service registration entries (tenant
     * signup, email-less/native complete) call this. Invitation acceptance deliberately does NOT:
     * a {@code switchTenant} invite first deactivates the old membership and removes its links
     * (see {@code InvitationRegistrationService}), so the subject is already free by the time a new
     * user is created — guarding before that would break the very tenant-switch it enables.
     */
    public void ensureNotAlreadyLinked(String provider, Map<String, Object> claims) {
        if (hasLink(provider, claims)) {
            throw new SsoAlreadyLinkedException();
        }
    }

    /**
     * Writes or refreshes the link after a successful, trusted resolution — a single atomic
     * upsert keyed on {@code (provider, subject, userId)}: an existing own link gets its
     * lastSeenAt refreshed, a first link is inserted, and two concurrent first logins cannot
     * race (the loser's insert hits the unique index and is reported as the conflict it is).
     * If the subject is already bound to a DIFFERENT user, the unique index rejects the insert
     * and the existing link wins — re-pointing is an explicit lifecycle action, never a login
     * side effect. Best-effort by contract: never fails the login that just succeeded.
     */
    public void link(String provider, Map<String, Object> claims, AuthUser user) {
        Optional<String> subject = subjectOfOptional(provider, claims);
        if (subject.isEmpty()) {
            return;
        }
        try {
            Query query = new Query(Criteria.where("provider").is(provider)
                    .and("subject").is(subject.get())
                    .and("userId").is(user.getId()));
            // provider/subject/userId come from the query's equality criteria — Mongo copies them
            // into the inserted document automatically; only the non-query fields need setOnInsert.
            Update update = new Update()
                    .setOnInsert("tenantId", user.getTenantId())
                    .setOnInsert("createdAt", Instant.now())
                    .set("lastSeenAt", Instant.now());
            var result = mongoTemplate.upsert(query, update, SsoIdentity.class);
            if (result.getUpsertedId() != null) {
                log.info("event=sso-identity-linked provider={} user={}", provider, user.getId());
            }
        } catch (DuplicateKeyException e) {
            log.warn("event=sso-identity-link-duplicate provider={} subject={} user={} — link already present (concurrent first login, or subject bound to another user)",
                    provider, subject.get(), user.getId());
        } catch (Exception e) {
            log.warn("Failed to write sso identity link for user {}: {}", user.getId(), e.getMessage());
        }
    }
}

