package com.openframe.core.constants;

import java.util.List;

/**
 * Names of the signed SSO flow cookies, single-sourced: the authorization server writes and
 * dispatches on them, and the gateway BFF clears them when a fresh login starts. Two modules,
 * one list — a name that exists in only one of them recreates the stale-cookie hijack this
 * class was extracted to prevent (a leftover flow cookie whose state the resolver injects into
 * the next login).
 */
public final class SsoFlowCookies {

    private SsoFlowCookies() {
    }

    public static final String OF_SSO_REG = "of_sso_reg";
    public static final String OF_SSO_INVITE = "of_sso_invite";
    public static final String OF_SSO_LOGIN = "of_sso_login";

    public static final List<String> ALL = List.of(OF_SSO_REG, OF_SSO_INVITE, OF_SSO_LOGIN);
}
