package com.openframe.core.email;

/**
 * What {@link EmailDomainPolicy#verdict} decided about one address, and why. Only {@link #ALLOWED} lets the
 * address through; the other values name the layer that stopped it.
 */
public enum EmailVerdict {

    /** No layer blocks the address. */
    ALLOWED,
    /** The address itself is on a {@link BlockedEmailAddressSource}. */
    BLOCKED_ADDRESS,
    /** Its domain is on the configured {@code blocked-domains} list or a {@link BlockedEmailDomainSource}. */
    BLOCKED_DOMAIN,
    /** Its domain was reported disposable by the external {@link DisposableDomainChecker}. */
    DISPOSABLE;

    public boolean isAllowed() {
        return this == ALLOWED;
    }
}
