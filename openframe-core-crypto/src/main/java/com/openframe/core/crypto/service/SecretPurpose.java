package com.openframe.core.crypto.service;

/**
 * The kind of secret a value holds. It is part of the associated data, so a ciphertext of one kind cannot be
 * passed off as another.
 */
public enum SecretPurpose {
    TENANT_SIGNING_KEY,
    SSO_CLIENT_SECRET,
    APPLE_REFRESH_TOKEN,
    AGENT_REGISTRATION_SECRET,
    AGENT_LOG_KEY,
    SCRIPT_ENV_VAR,
    AI_PROVIDER_KEY
}
