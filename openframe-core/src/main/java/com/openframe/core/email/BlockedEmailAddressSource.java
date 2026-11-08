package com.openframe.core.email;

/**
 * A list of blocked email addresses kept outside the configuration, for example in a database a backoffice
 * edits. {@link EmailDomainPolicy} asks every source bean before any domain layer, so one address can be
 * blocked without blocking everyone else on its domain, and the {@code allowed-domains} carve-out does not
 * lift it.
 * <p>
 * Implementations MUST fail open: a source that cannot answer returns {@code false}, so a datastore
 * problem never stops someone registering or being invited.
 */
public interface BlockedEmailAddressSource {

    /**
     * @param email the whole address in the {@link EmailDomainPolicy#normalizeEmail} form: trimmed and lowercase,
     *              no {@code +tag}, and on Gmail no dots in the local part
     * @return {@code true} only when the address is positively known to be blocked
     */
    boolean isBlocked(String email);
}
