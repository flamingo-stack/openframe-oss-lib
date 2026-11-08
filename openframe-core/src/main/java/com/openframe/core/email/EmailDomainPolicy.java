package com.openframe.core.email;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * Decides whether an email address may be used to register, be invited, or be configured for SSO
 * auto-provisioning.
 * <p>
 * For an address, first every {@link BlockedEmailAddressSource} bean (single addresses kept outside the
 * configuration, such as a list a backoffice edits). Then three domain layers: the configured
 * {@code blocked-domains} list, every {@link BlockedEmailDomainSource} bean, and — only for domains that
 * pass both — a {@link DisposableDomainChecker} lookup. Every source and the external check fail open, so an
 * unreachable datastore or third party never blocks a flow. The configured {@code allowed-domains} carve-out
 * wins over every domain layer, but not over an address block: blocking one address is the more specific
 * decision. {@link #verdict} says which layer decided.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailDomainPolicy {

    private final EmailDomainPolicyProperties properties;
    private final DisposableDomainChecker disposableDomainChecker;
    /** Every source bean in {@code @Order}; empty when a deployment has none. */
    private final List<BlockedEmailDomainSource> blockedDomainSources;
    /** Every address source bean in {@code @Order}; empty when a deployment has none. */
    private final List<BlockedEmailAddressSource> blockedAddressSources;

    /** @throws IllegalArgumentException if the address is blocked or uses a blocked domain */
    public void ensureEmailAllowed(String email) {
        EmailVerdict verdict = verdict(email);
        if (verdict == EmailVerdict.BLOCKED_ADDRESS) {
            throw new IllegalArgumentException(
                    "This email address cannot be used. Please use your work email address.");
        }
        if (!verdict.isAllowed()) {
            String domain = extractDomain(email);
            throw new IllegalArgumentException(
                    "Email addresses from " + domain + " cannot be used. Please use your work email address.");
        }
    }

    /**
     * Which layer, if any, blocks the address: the address sources first, then the domain layers in the order
     * {@link #isDomainBlocked} applies them. A disabled policy, or input with no address in it, is
     * {@link EmailVerdict#ALLOWED}.
     */
    public EmailVerdict verdict(String email) {
        if (!properties.isEnabled()) {
            return EmailVerdict.ALLOWED;
        }
        String domain = extractDomain(email);
        if (domain == null) {
            return EmailVerdict.ALLOWED;
        }
        if (isAddressListed(normalizeEmail(email))) {
            return EmailVerdict.BLOCKED_ADDRESS;
        }
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
            String normalized = normalize(domain);
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
        String normalized = normalize(domain);
        return normalized != null && !domainVerdict(normalized).isAllowed();
    }

    /** The domain layers for an already normalized domain; the policy is known to be enabled. */
    private EmailVerdict domainVerdict(String normalized) {
        if (isDomainListed(normalized)) {
            return EmailVerdict.BLOCKED_DOMAIN;
        }
        if (contains(properties.getAllowedDomains(), normalized) || !properties.getDisposableCheck().isEnabled()) {
            return EmailVerdict.ALLOWED;
        }
        boolean disposable = disposableDomainChecker.isDisposable(normalized);
        if (disposable) {
            log.info("Domain '{}' blocked as disposable by external check", normalized);
            return EmailVerdict.DISPOSABLE;
        }
        return EmailVerdict.ALLOWED;
    }

    private boolean isAddressListed(String address) {
        return blockedAddressSources.stream().anyMatch(source -> addressBlockedBy(source, address));
    }

    private static boolean addressBlockedBy(BlockedEmailAddressSource source, String address) {
        boolean blocked = source.isBlocked(address);
        if (blocked) {
            log.debug("Address on domain '{}' blocked by {}", extractDomain(address), source.getClass().getSimpleName());
        }
        return blocked;
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
        return blockedDomainSources.stream().anyMatch(source -> blockedBy(source, normalized));
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

    /**
     * The whole address as every address source compares it: trimmed and lowercase, a {@code +tag} kept as
     * written; {@code null} for blank input.
     */
    public static String normalizeEmail(String email) {
        return normalize(email);
    }

    /**
     * The domain of an address, trimmed and lowercase: what a log line may name in place of the address;
     * {@code null} when the input has no {@code @} or nothing after it.
     */
    public static String domainOf(String email) {
        return extractDomain(email);
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
