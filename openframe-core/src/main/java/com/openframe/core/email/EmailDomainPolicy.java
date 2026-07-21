package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.Locale;

/**
 * Decides whether an email domain may be used to register, be invited, or be configured for SSO
 * auto-provisioning.
 * <p>
 * Two layers: the built-in {@link BlockedEmailDomains} list (plus anything added via configuration),
 * and — only for domains that pass it — a {@link DisposableDomainChecker} lookup. The second layer
 * fails open, so an unreachable third party never blocks a flow.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDomainPolicy {

    private final EmailDomainPolicyProperties properties;
    private final DisposableDomainChecker disposableDomainChecker;

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
        if (contains(properties.getAllowedDomains(), normalized)) {
            return false;
        }
        if (BlockedEmailDomains.DEFAULT.contains(normalized) || contains(properties.getBlockedDomains(), normalized)) {
            log.debug("Domain '{}' blocked by list", normalized);
            return true;
        }
        if (!properties.getDisposableCheck().isEnabled()) {
            return false;
        }
        boolean disposable = disposableDomainChecker.isDisposable(normalized);
        if (disposable) {
            log.info("Domain '{}' blocked as disposable by external check", normalized);
        }
        return disposable;
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
