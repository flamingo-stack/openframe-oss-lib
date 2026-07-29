package com.openframe.authz.security;

/**
 * Shared shape of the signed SSO flow cookie payloads: the OAuth state this flow generated,
 * plus its expiry. Lets {@link SsoCookieCodec} read both without reflection.
 */
public interface SsoCookiePayload {

    /** OAuth {@code state} generated when the flow started. */
    String s();

    /** Expiry as epoch seconds; {@code 0} means no expiry. */
    long exp();
}
