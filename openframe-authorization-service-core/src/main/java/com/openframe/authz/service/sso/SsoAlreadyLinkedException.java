package com.openframe.authz.service.sso;

import com.openframe.core.exception.AuthFlowException;

import static com.openframe.core.exception.AuthErrorCode.ACCOUNT_ALREADY_LINKED;

/**
 * The provider identity presented at a registration entry is already linked to a user — the
 * one-SSO-account-one-user invariant forbids creating a second account for it.
 */
public class SsoAlreadyLinkedException extends AuthFlowException {
    public SsoAlreadyLinkedException() {
        super(ACCOUNT_ALREADY_LINKED, "This account is already connected to an organization. Please sign in instead.");
    }
}
