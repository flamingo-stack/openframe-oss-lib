package com.openframe.core.crypto.service;

import java.nio.charset.StandardCharsets;

/**
 * Who a secret belongs to and what it is. Bound into every Tink ciphertext as associated data: a value only
 * decrypts under the context it was encrypted with. A null tenant marks a platform-level secret.
 */
public record EncryptionContext(String tenantId, SecretPurpose purpose) {

    public EncryptionContext {
        if (purpose == null) {
            throw new IllegalArgumentException("Secret purpose is required");
        }
        if (tenantId != null && tenantId.isBlank()) {
            throw new IllegalArgumentException("Tenant id must not be blank");
        }
    }

    public static EncryptionContext forTenant(String tenantId, SecretPurpose purpose) {
        if (tenantId == null) {
            throw new IllegalArgumentException("Tenant id is required");
        }
        return new EncryptionContext(tenantId, purpose);
    }

    public static EncryptionContext platform(SecretPurpose purpose) {
        return new EncryptionContext(null, purpose);
    }

    byte[] associatedData() {
        String scope = tenantId == null ? "" : tenantId;
        return (scope + '\u0000' + purpose.name()).getBytes(StandardCharsets.UTF_8);
    }
}
