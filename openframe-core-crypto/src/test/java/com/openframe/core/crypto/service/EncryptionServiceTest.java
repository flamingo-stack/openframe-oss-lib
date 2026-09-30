package com.openframe.core.crypto.service;

import com.openframe.core.exception.EncryptionException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EncryptionServiceTest {

    private static final String PASSWORD = "0123456789abcdef0123456789abcdef";
    private static final String SALT = "0123456789abcdef";

    private final EncryptionService service = new EncryptionService(PASSWORD, SALT);

    @Test
    void shouldRoundTripAndNeverReturnPlainText() {
        String encrypted = service.encryptClientSecret("client-secret-value");

        assertThat(encrypted).doesNotContain("client-secret-value");
        assertThat(service.decryptClientSecret(encrypted)).isEqualTo("client-secret-value");
        assertThat(service.decrypt(service.encrypt("x"))).isEqualTo("x");
    }

    @Test
    void shouldUseRandomIvSoEqualInputsDiffer() {
        assertThat(service.encrypt("same")).isNotEqualTo(service.encrypt("same"));
    }

    @Test
    void shouldNotDecryptWithAnotherPassword() {
        String encrypted = service.encrypt("secret");
        EncryptionService other = new EncryptionService("fedcba9876543210fedcba9876543210", SALT);

        assertThatThrownBy(() -> other.decrypt(encrypted)).isInstanceOf(EncryptionException.class);
    }

    @Test
    void shouldRejectTamperedCiphertext() {
        String encrypted = service.encrypt("secret");
        String tampered = encrypted.substring(0, encrypted.length() - 2) + (encrypted.endsWith("00") ? "11" : "00");

        assertThatThrownBy(() -> service.decrypt(tampered)).isInstanceOf(EncryptionException.class);
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"  "})
    void shouldRejectBlankInput(String input) {
        assertThatThrownBy(() -> service.encrypt(input)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.decrypt(input)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.encryptClientSecret(input)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.decryptClientSecret(input)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void shouldRefuseWeakPasswordOrSaltAtStartup() {
        assertThatThrownBy(() -> new EncryptionService("short", SALT)).hasMessageContaining("at least 32 characters");
        assertThatThrownBy(() -> new EncryptionService(null, SALT)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new EncryptionService(PASSWORD, "abc")).hasMessageContaining("at least 16 characters");
    }
}
