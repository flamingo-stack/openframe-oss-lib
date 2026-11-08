package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

import static com.openframe.core.email.EmailAddressCanonicalizer.canonicalAddress;
import static com.openframe.core.email.EmailAddressCanonicalizer.canonicalDomain;
import static com.openframe.core.email.EmailAddressCanonicalizer.domainOf;
import static com.openframe.core.email.EmailAddressCanonicalizer.hasDomain;
import static com.openframe.core.email.EmailAddressCanonicalizer.hasLocalPartAndDomain;

// An address block beats the allowed-domains carve-out: blocking one address is the more specific decision.
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDomainPolicy {

    private final EmailDomainPolicyProperties properties;
    private final DisposableDomainChecker disposableDomainChecker;
    /** Every source bean in {@code @Order}; empty when a deployment has none. */
    private final List<BlockedEmailDomainSource> blockedDomainSources;
    private final List<BlockedEmailAddressSource> blockedAddressSources;

    public void ensureEmailAllowed(String email) {
        EmailVerdict verdict = verdict(email);
        if (verdict == EmailVerdict.BLOCKED_ADDRESS) {
            throw new IllegalArgumentException(
                    "This email address cannot be used. Please use your work email address.");
        }
        if (!verdict.isAllowed()) {
            String domain = domainOf(email);
            throw new IllegalArgumentException(
                    "Email addresses from " + domain + " cannot be used. Please use your work email address.");
        }
    }

    public EmailVerdict verdict(String email) {
        if (isOutOfScope(email)) {
            return EmailVerdict.ALLOWED;
        }
        if (isAddressListed(email)) {
            return EmailVerdict.BLOCKED_ADDRESS;
        }
        String domain = domainOf(email);
        return domainVerdict(domain);
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
            String normalized = canonicalDomain(domain);
            if (normalized != null && isDomainBlocked(normalized)) {
                throw new IllegalArgumentException(
                        normalized + " cannot be used for auto-provisioning. Please use a domain your organization owns.");
            }
        }
    }

    /** Non-throwing form, for paths that must not raise — e.g. SSO auto-provisioning on login. */
    public boolean isEmailAllowed(String email) {
        return verdict(email).isAllowed();
    }

    public boolean isDomainBlocked(String domain) {
        if (!properties.isEnabled()) {
            return false;
        }
        String normalized = canonicalDomain(domain);
        if (normalized == null) {
            return false;
        }
        EmailVerdict verdict = domainVerdict(normalized);
        return !verdict.isAllowed();
    }

    private boolean isOutOfScope(String email) {
        return !properties.isEnabled() || !hasDomain(email);
    }

    private EmailVerdict domainVerdict(String normalized) {
        if (isDomainListed(normalized)) {
            return EmailVerdict.BLOCKED_DOMAIN;
        }
        if (shouldSkipDisposableCheck(normalized)) {
            return EmailVerdict.ALLOWED;
        }
        // A disposable domain is one more blocked domain; the check stays apart from the lists only because it calls out.
        boolean disposable = disposableDomainChecker.isDisposable(normalized);
        if (disposable) {
            log.info("Domain '{}' blocked as disposable by external check", normalized);
            return EmailVerdict.BLOCKED_DOMAIN;
        }
        return EmailVerdict.ALLOWED;
    }

    private boolean shouldSkipDisposableCheck(String normalized) {
        Collection<String> allowedDomains = properties.getAllowedDomains();
        return contains(allowedDomains, normalized) || !properties.getDisposableCheck().isEnabled();
    }

    private boolean isAddressListed(String email) {
        if (!hasLocalPartAndDomain(email)) {
            return false;
        }
        String address = canonicalAddress(email);
        return blockedAddressSources.stream().anyMatch(source -> isAddressBlockedBy(source, address));
    }

    private static boolean isAddressBlockedBy(BlockedEmailAddressSource source, String address) {
        boolean blocked = source.isBlocked(address);
        if (blocked) {
            log.debug("Address on domain '{}' blocked by {}", domainOf(address), source.getClass().getSimpleName());
        }
        return blocked;
    }

    /**
     * The list layers only: the configured {@code blocked-domains} and every {@link BlockedEmailDomainSource},
     * minus the {@code allowed-domains} carve-out. No external call, so it is safe to ask for many domains
     * at once, as the tenant trust scoring does for every owner domain.
     */
    public boolean isDomainListed(String domain) {
        String normalized = canonicalDomain(domain);
        if (normalized == null || contains(properties.getAllowedDomains(), normalized)) {
            return false;
        }
        if (contains(properties.getBlockedDomains(), normalized)) {
            log.debug("Domain '{}' blocked by the configured list", normalized);
            return true;
        }
        return blockedDomainSources.stream().anyMatch(source -> blockedBy(source, normalized));
    }

    private static boolean blockedBy(BlockedEmailDomainSource source, String normalized) {
        boolean blocked = source.isBlocked(normalized);
        if (blocked) {
            log.debug("Domain '{}' blocked by {}", normalized, source.getClass().getSimpleName());
        }
        return blocked;
    }

    private static boolean contains(Collection<String> domains, String normalized) {
        if (domains == null || domains.isEmpty()) {
            return false;
        }
        return domains.stream()
                .map(EmailAddressCanonicalizer::canonicalDomain)
                .anyMatch(normalized::equals);
    }
}
