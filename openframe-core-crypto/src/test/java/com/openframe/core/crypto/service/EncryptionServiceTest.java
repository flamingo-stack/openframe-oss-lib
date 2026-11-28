package com.openframe.core.crypto.service;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.exception.EncryptionException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.security.crypto.encrypt.Encryptors;

import java.util.Base64;

import static com.openframe.core.crypto.service.SecretPurpose.AI_PROVIDER_KEY;
import static com.openframe.core.crypto.service.SecretPurpose.SSO_CLIENT_SECRET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EncryptionServiceTest {

    private static final String PASSWORD = "0123456789abcdef0123456789abcdef";
    private static final String SALT = "0123456789abcdef";
    private static final EncryptionContext ACME_SSO = EncryptionContext.forTenant("acme", SSO_CLIENT_SECRET);

    private static KeysetHandle keyset;

    @BeforeAll
    static void registerTink() throws Exception {
        AeadConfig.register();
        keyset = newKeyset();
    }

    private static KeysetHandle newKeyset() throws Exception {
        return KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM);
    }

    private static String legacyCiphertext(String plain) {
        return Encryptors.text(PASSWORD, SALT).encrypt(plain);
    }

    @Nested
    class Tink {

        private final EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);

        @Test
        void shouldRoundTripWithTheSameContext() {
            String encrypted = service.encrypt("client-secret-value", ACME_SSO);

            assertThat(encrypted).doesNotContain("client-secret-value");
            assertThat(service.decrypt(encrypted, ACME_SSO)).isEqualTo("client-secret-value");
        }

        @Test
        void shouldMarkNewCiphertextWithTheTinkFormat() {
            String encrypted = service.encrypt("secret", ACME_SSO);

            assertThat(encrypted).startsWith(EncryptionService.TINK_PREFIX);
            assertThat(service.isLegacy(encrypted)).isFalse();
        }

        @Test
        void shouldUseRandomNonceSoEqualInputsDiffer() {
            assertThat(service.encrypt("same", ACME_SSO)).isNotEqualTo(service.encrypt("same", ACME_SSO));
        }

        @Test
        void shouldRejectAnotherTenant() {
            String encrypted = service.encrypt("secret", ACME_SSO);

            assertThatThrownBy(() -> service.decrypt(encrypted, EncryptionContext.forTenant("globex", SSO_CLIENT_SECRET)))
                    .isInstanceOf(EncryptionException.class);
        }

        @Test
        void shouldRejectAnotherPurpose() {
            String encrypted = service.encrypt("secret", ACME_SSO);

            assertThatThrownBy(() -> service.decrypt(encrypted, EncryptionContext.forTenant("acme", AI_PROVIDER_KEY)))
                    .isInstanceOf(EncryptionException.class);
        }

        @Test
        void shouldRejectPlatformContextForTenantValue() {
            String encrypted = service.encrypt("secret", ACME_SSO);

            assertThatThrownBy(() -> service.decrypt(encrypted, EncryptionContext.platform(SSO_CLIENT_SECRET)))
                    .isInstanceOf(EncryptionException.class);
        }

        @Test
        void shouldRejectTamperedCiphertext() {
            String encrypted = service.encrypt("secret", ACME_SSO);
            byte[] raw = Base64.getDecoder().decode(encrypted.substring(EncryptionService.TINK_PREFIX.length()));
            raw[raw.length - 1] ^= 0x01;
            String tampered = EncryptionService.TINK_PREFIX + Base64.getEncoder().encodeToString(raw);

            assertThatThrownBy(() -> service.decrypt(tampered, ACME_SSO)).isInstanceOf(EncryptionException.class);
        }

        @Test
        void shouldFailInsteadOfReturningGarbageForAnotherKeyset() throws Exception {
            String encrypted = service.encrypt("secret", ACME_SSO);
            EncryptionService other = EncryptionService.withKeyset(newKeyset(), true, PASSWORD, SALT);

            assertThatThrownBy(() -> other.decrypt(encrypted, ACME_SSO)).isInstanceOf(EncryptionException.class);
        }

        @Test
        void shouldReadOldValuesAfterKeysetRotation() throws Exception {
            String beforeRotation = service.encrypt("secret", ACME_SSO);
            KeysetHandle rotated = KeysetHandle.newBuilder(keyset)
                    .addEntry(KeysetHandle.generateEntryFromParameters(PredefinedAeadParameters.AES256_GCM)
                            .withRandomId().makePrimary())
                    .build();
            EncryptionService afterRotation = EncryptionService.withKeyset(rotated, true, PASSWORD, SALT);

            assertThat(afterRotation.decrypt(beforeRotation, ACME_SSO)).isEqualTo("secret");
            assertThat(afterRotation.decrypt(afterRotation.encrypt("new", ACME_SSO), ACME_SSO)).isEqualTo("new");
        }
    }

    @Nested
    class Legacy {

        @Test
        void shouldDecryptLegacyValueWithTheLegacyPassword() {
            EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);
            String legacy = legacyCiphertext("old-secret");

            assertThat(service.isLegacy(legacy)).isTrue();
            assertThat(service.decrypt(legacy, ACME_SSO)).isEqualTo("old-secret");
        }

        @Test
        void shouldFailClearlyOnLegacyValueWithoutLegacyPassword() {
            EncryptionService service = EncryptionService.withKeyset(keyset, true, null, null);
            String legacy = legacyCiphertext("old-secret");

            assertThatThrownBy(() -> service.decrypt(legacy, ACME_SSO))
                    .isInstanceOf(EncryptionException.class)
                    .hasMessageContaining("legacy");
        }

        @Test
        void shouldNotTreatTinkValueAsLegacyEvenIfLegacyPasswordIsSet() {
            EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);

            assertThat(service.isLegacy(service.encrypt("secret", ACME_SSO))).isFalse();
            assertThat(service.isLegacy(legacyCiphertext("secret"))).isTrue();
        }

        @Test
        void shouldNotTryTinkOnALegacyValue() {
            EncryptionService service = EncryptionService.withKeyset(keyset, true, "fedcba9876543210fedcba9876543210", SALT);
            String legacy = legacyCiphertext("old-secret");

            // the legacy password is wrong; a Tink attempt would surface a different error
            assertThatThrownBy(() -> service.decrypt(legacy, ACME_SSO))
                    .isInstanceOf(EncryptionException.class)
                    .hasMessageContaining("legacy");
        }

        @Test
        void legacyOnlyServiceWritesAndReadsTheLegacyFormat() {
            EncryptionService service = new EncryptionService(PASSWORD, SALT);

            String encrypted = service.encrypt("secret", ACME_SSO);

            assertThat(service.isLegacy(encrypted)).isTrue();
            assertThat(Encryptors.text(PASSWORD, SALT).decrypt(encrypted)).isEqualTo("secret");
            assertThat(service.decrypt(encrypted, ACME_SSO)).isEqualTo("secret");
        }

        @Test
        void legacyOnlyServiceRejectsTinkValues() {
            String tink = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT).encrypt("secret", ACME_SSO);
            EncryptionService service = new EncryptionService(PASSWORD, SALT);

            assertThatThrownBy(() -> service.decrypt(tink, ACME_SSO)).isInstanceOf(EncryptionException.class);
        }
    }

    @Nested
    class WriteFlag {

        @Test
        void shouldWriteLegacyAndReadBothWhenTinkWriteIsOff() {
            EncryptionService service = EncryptionService.withKeyset(keyset, false, PASSWORD, SALT);
            String tink = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT).encrypt("tink", ACME_SSO);

            String written = service.encrypt("secret", ACME_SSO);

            assertThat(service.isLegacy(written)).isTrue();
            assertThat(service.decrypt(written, ACME_SSO)).isEqualTo("secret");
            assertThat(service.decrypt(tink, ACME_SSO)).isEqualTo("tink");
        }

        @Test
        void shouldWriteTinkWhenTinkWriteIsOn() {
            EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);

            assertThat(service.encrypt("secret", ACME_SSO)).startsWith(EncryptionService.TINK_PREFIX);
        }

        @Test
        void writesTinkWithKeysetAndTinkWriteOn() {
            assertThat(EncryptionService.withKeyset(keyset, true, PASSWORD, SALT).writesTink()).isTrue();
        }

        @Test
        void doesNotWriteTinkWithKeysetButTinkWriteOff() {
            assertThat(EncryptionService.withKeyset(keyset, false, PASSWORD, SALT).writesTink()).isFalse();
        }

        @Test
        void doesNotWriteTinkInLegacyMode() {
            assertThat(new EncryptionService(PASSWORD, SALT).writesTink()).isFalse();
        }

        @Test
        void shouldRefuseTinkWriteOffWithoutLegacyPassword() {
            assertThatThrownBy(() -> EncryptionService.withKeyset(keyset, false, null, null))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Nested
    class Reencrypt {

        private final EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);

        @Test
        void shouldTurnALegacyValueIntoTink() {
            String reencrypted = service.reencrypt(legacyCiphertext("old-secret"), ACME_SSO);

            assertThat(reencrypted).startsWith(EncryptionService.TINK_PREFIX);
            assertThat(service.decrypt(reencrypted, ACME_SSO)).isEqualTo("old-secret");
        }

        @Test
        void shouldLeaveATinkValueUntouched() {
            String tink = service.encrypt("secret", ACME_SSO);

            assertThat(service.reencrypt(tink, ACME_SSO)).isSameAs(tink);
        }

        @Test
        void shouldRefuseWithoutAKeyset() {
            EncryptionService legacyOnly = new EncryptionService(PASSWORD, SALT);

            assertThatThrownBy(() -> legacyOnly.reencrypt(legacyCiphertext("x"), ACME_SSO))
                    .isInstanceOf(IllegalStateException.class);
        }
    }

    @Nested
    class Validation {

        private final EncryptionService service = EncryptionService.withKeyset(keyset, true, PASSWORD, SALT);

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"  "})
        void shouldRejectBlankInput(String input) {
            assertThatThrownBy(() -> service.encrypt(input, ACME_SSO)).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.decrypt(input, ACME_SSO)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldRejectMissingContext() {
            assertThatThrownBy(() -> service.encrypt("x", null)).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> service.decrypt("x", null)).isInstanceOf(IllegalArgumentException.class);
        }

        @ParameterizedTest
        @NullAndEmptySource
        @ValueSource(strings = {"  "})
        void shouldRejectBlankTenantInTenantContext(String tenantId) {
            assertThatThrownBy(() -> EncryptionContext.forTenant(tenantId, SSO_CLIENT_SECRET))
                    .isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldRejectMissingPurpose() {
            assertThatThrownBy(() -> EncryptionContext.forTenant("acme", null)).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> EncryptionContext.platform(null)).isInstanceOf(IllegalArgumentException.class);
        }

        @Test
        void shouldRefuseWeakLegacyPasswordOrSalt() {
            assertThatThrownBy(() -> new EncryptionService("short", SALT)).hasMessageContaining("at least 32 characters");
            assertThatThrownBy(() -> new EncryptionService(null, SALT)).isInstanceOf(IllegalArgumentException.class);
            assertThatThrownBy(() -> new EncryptionService(PASSWORD, "abc")).hasMessageContaining("at least 16 characters");
        }

        @Test
        void shouldRefuseMissingKeyset() {
            assertThatThrownBy(() -> EncryptionService.withKeyset(null, true, PASSWORD, SALT))
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }
}
