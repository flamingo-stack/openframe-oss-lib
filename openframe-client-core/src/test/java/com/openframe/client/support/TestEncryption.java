package com.openframe.client.support;

import com.openframe.core.crypto.service.EncryptionService;

// one test key for every test that seals or reveals script secrets
public final class TestEncryption {

    public static final EncryptionService SERVICE =
            new EncryptionService("test-encryption-password-of-32-chars!", "74f62c51327175b0");

    private TestEncryption() {
    }
}
