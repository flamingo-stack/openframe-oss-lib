package com.openframe.authz.service.sso;

/**
 * The provider identity presented at a registration entry is already linked to a user — the
 * one-SSO-account-one-user invariant forbids creating a second account for it.
 */
public class SsoAlreadyLinkedException extends RuntimeException {
    public SsoAlreadyLinkedException() {
        super("This account is already connected to an organization. Please sign in instead.");
    }
}
