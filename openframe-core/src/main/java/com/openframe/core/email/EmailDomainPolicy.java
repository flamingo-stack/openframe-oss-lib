package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Locale;

/**
 * Decides whether an email domain may be used to register, be invited, or be configured for SSO
 * auto-provisioning.
 * <p>
 * Three layers: the configured {@code blocked-domains} list, every {@link BlockedEmailDomainSource} bean
 * (a list kept outside the configuration, such as one a backoffice edits), and — only for domains that
 * pass both — a {@link DisposableDomainChecker} lookup. The last two fail open, so an unreachable
 * datastore or third party never blocks a flow. The configured {@code allowed-domains} carve-out wins
 * over every layer.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDomainPolicy {

    private final EmailDomainPolicyProperties properties;
    private final DisposableDomainChecker disposableDomainChecker;
    /** Resolved lazily, so a deployment without a source bean still gets the policy. */
    private final ObjectProvider<BlockedEmailDomainSource> blockedDomainSources;

    /** @throws IllegalArgumentException if the address uses a blocked domain */
    public void ensureEmailAllowed(String email) {
        String domain = extractDomain(email);
        if (domain != null && isDomainBlocked(domain)) {
            throw new IllegalArgumentException(
                    "Email addresses from " + domain + " cannot be used. Please use your work email address.");
        }
    }

    /**
     * Validates domains configured for SSO auto-provisioning.
     *
     * @throws IllegalArgumentException if any is blocked
     */
    public void ensureDomainsAllowed(Collection<String> domains) {
        if (domains == null) {
            return;
        }
        for (String domain : domains) {
            String normalized = normalize(domain);
            if (normalized != null && isDomainBlocked(normalized)) {
                throw new IllegalArgumentException(
                        normalized + " cannot be used for auto-provisioning. Please use a domain your organization owns.");
            }
        }
    }

    /** Non-throwing form, for paths that must not raise — e.g. SSO auto-provisioning on login. */
    public boolean isEmailAllowed(String email) {
        String domain = extractDomain(email);
        return domain == null || !isDomainBlocked(domain);
    }

    public boolean isDomainBlocked(String domain) {
        if (!properties.isEnabled()) {
            return false;
        }
        String normalized = normalize(domain);
        if (normalized == null) {
            return false;
        }
        if (isDomainListed(normalized)) {
            return true;
        }
        if (contains(properties.getAllowedDomains(), normalized) || !properties.getDisposableCheck().isEnabled()) {
            return false;
        }
        boolean disposable = disposableDomainChecker.isDisposable(normalized);
        if (disposable) {
            log.info("Domain '{}' blocked as disposable by external check", normalized);
        }
        return disposable;
    }

    /**
     * The list layers only: the configured {@code blocked-domains} and every {@link BlockedEmailDomainSource},
     * minus the {@code allowed-domains} carve-out. No external call, so it is safe to ask for many domains
     * at once, as the tenant trust scoring does for every owner domain.
     */
    public boolean isDomainListed(String domain) {
        String normalized = normalize(domain);
        if (normalized == null || contains(properties.getAllowedDomains(), normalized)) {
            return false;
        }
        if (contains(properties.getBlockedDomains(), normalized)) {
            log.debug("Domain '{}' blocked by the configured list", normalized);
            return true;
        }
        return blockedDomainSources.orderedStream().anyMatch(source -> blockedBy(source, normalized));
    }

    private static boolean blockedBy(BlockedEmailDomainSource source, String normalized) {
        boolean blocked = source.isBlocked(normalized);
        if (blocked) {
            log.debug("Domain '{}' blocked by {}", normalized, source.getClass().getSimpleName());
        }
        return blocked;
    }

    /** The domain as every layer compares it: trimmed and lowercase; {@code null} for blank input. */
    public static String normalizeDomain(String domain) {
        return normalize(domain);
    }

    private static boolean contains(Collection<String> domains, String normalized) {
        if (domains == null || domains.isEmpty()) {
            return false;
        }
        return domains.stream()
                .map(EmailDomainPolicy::normalize)
                .anyMatch(normalized::equals);
    }

    private static String extractDomain(String email) {
        if (email == null) {
            return null;
        }
        int at = email.lastIndexOf('@');
        if (at < 0 || at == email.length() - 1) {
            return null;
        }
        return normalize(email.substring(at + 1));
    }

    private static String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim().toLowerCase(Locale.ROOT);
        return trimmed.isEmpty() ? null : trimmed;
    }
}
