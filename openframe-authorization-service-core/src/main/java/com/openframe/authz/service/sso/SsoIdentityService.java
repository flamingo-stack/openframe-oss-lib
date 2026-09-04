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
                .flatMap(subject -> findBySubject(provider, subject));
    }

    /** Explicit lifecycle removal (cross-tenant switch, admin unlink). Not a login side effect. */
    public void removeUserLinks(String userId) {
        ssoIdentityRepository.deleteByUserId(userId);
    }

    public Optional<SsoIdentity> findBySubject(String provider, String subject) {
        return ssoIdentityRepository.findByProviderAndSubject(provider, subject);
    }

    /**
     * Registration guard for the one-SSO-account-one-user invariant: throws when this identity is
     * already linked, so a bound subject signs in rather than spawning a second account it could
     * never reach through this provider again. Every registration entry must call this.
     */
    public void ensureNotAlreadyLinked(String provider, Map<String, Object> claims) {
        if (findLink(provider, claims).isPresent()) {
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
        Optional<String> subject = subjectOf(provider, claims);
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
