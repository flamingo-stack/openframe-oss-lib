package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;

import static com.openframe.core.email.EmailAddressCanonicalizer.canonicalAddress;
import static com.openframe.core.email.EmailAddressCanonicalizer.canonicalDomain;
import static com.openframe.core.email.EmailAddressCanonicalizer.domainOf;
import static com.openframe.core.email.EmailAddressCanonicalizer.isAddress;

/**
 * Decides whether an email address may register, be invited, or be configured for SSO auto-provisioning.
 * Layers, first match wins: blocked addresses, then the domain lists (configured, then every
 * {@link BlockedEmailDomainSource}), then the external disposable check. Sources and the external check fail
 * open. The {@code allowed-domains} carve-out lifts the domain layers only: an address block is the more
 * specific decision.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDomainPolicy {

    private final EmailDomainPolicyProperties properties;
    private final DisposableDomainChecker disposableDomainChecker;
    private final List<BlockedEmailDomainSource> blockedDomainSources;
    private final List<BlockedEmailAddressSource> blockedAddressSources;

    public EmailVerdict verdict(String email) {
        String domain = domainOf(email);
        if (!properties.isEnabled() || domain == null) {
            return EmailVerdict.ALLOWED;
        }
        if (isAddressBlocked(email)) {
            return EmailVerdict.BLOCKED_ADDRESS;
        }
        return isDomainBlocked(domain) ? EmailVerdict.BLOCKED_DOMAIN : EmailVerdict.ALLOWED;
    }

    /** @throws IllegalArgumentException if the address or its domain is blocked */
    public void ensureEmailAllowed(String email) {
        switch (verdict(email)) {
            case BLOCKED_ADDRESS -> throw new IllegalArgumentException(
                    "This email address cannot be used. Please use your work email address.");
            case BLOCKED_DOMAIN -> throw new IllegalArgumentException(
                    "Email addresses from " + domainOf(email) + " cannot be used. Please use your work email address.");
            case ALLOWED -> {
            }
        }
    }

    /** Non-throwing form, for paths that must not raise, e.g. SSO auto-provisioning on login. */
    public boolean isEmailAllowed(String email) {
        return verdict(email).isAllowed();
    }

    /** @throws IllegalArgumentException if any domain configured for SSO auto-provisioning is blocked */
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

    public boolean isDomainBlocked(String domain) {
        String normalized = canonicalDomain(domain);
        if (!properties.isEnabled() || normalized == null) {
            return false;
        }
        return isDomainListed(normalized) || isDisposable(normalized);
    }

    /**
     * The domain lists only, minus the {@code allowed-domains} carve-out. No external call, so it is safe to ask
     * for many domains at once, as the tenant trust scoring does for every owner domain.
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
        return blockedDomainSources.stream().anyMatch(source -> isBlockedBy(source, normalized));
    }

    private boolean isAddressBlocked(String email) {
        if (!isAddress(email)) {
            return false;
        }
        String address = canonicalAddress(email);
        return blockedAddressSources.stream().anyMatch(source -> source.isBlocked(address));
    }

    private boolean isDisposable(String domain) {
        if (contains(properties.getAllowedDomains(), domain) || !properties.getDisposableCheck().isEnabled()) {
            return false;
        }
        boolean disposable = disposableDomainChecker.isDisposable(domain);
        if (disposable) {
            log.info("Domain '{}' blocked as disposable by external check", domain);
        }
        return disposable;
    }

    private static boolean isBlockedBy(BlockedEmailDomainSource source, String domain) {
        boolean blocked = source.isBlocked(domain);
        if (blocked) {
            log.debug("Domain '{}' blocked by {}", domain, source.getClass().getSimpleName());
        }
        return blocked;
    }

    private static boolean contains(Collection<String> domains, String normalized) {
        return domains != null && domains.stream()
                .map(EmailAddressCanonicalizer::canonicalDomain)
                .anyMatch(normalized::equals);
    }
}
