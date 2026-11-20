package com.openframe.core.crypto.config;

import com.google.crypto.tink.Aead;
import com.google.crypto.tink.InsecureSecretKeyAccess;
import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.KmsClient;
import com.google.crypto.tink.RegistryConfiguration;
import com.google.crypto.tink.TinkJsonProtoKeysetFormat;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.crypto.service.SecretPurpose;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import com.openframe.core.exception.EncryptionException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.support.StaticListableBeanFactory;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

import java.security.GeneralSecurityException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EncryptionConfigurationTest {

    private static final String KMS_URI = "gcp-kms://projects/p/locations/global/keyRings/r/cryptoKeys/app-encryption";
    private static final String PASSWORD = "0123456789abcdef0123456789abcdef";
    private static final String SALT = "0123456789abcdef";
    private static final EncryptionContext CONTEXT = EncryptionContext.forTenant("acme", SecretPurpose.SSO_CLIENT_SECRET);

    private static KeysetHandle dataKeyset;
    private static Aead kek;
    private static Aead otherKek;
    private static String wrappedKeyset;
    private static String cleartextKeyset;

    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withUserConfiguration(EncryptionConfiguration.class);

    @BeforeAll
    static void keysets() throws Exception {
        AeadConfig.register();
        dataKeyset = KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM);
        kek = KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM).getPrimitive(RegistryConfiguration.get(), Aead.class);
        otherKek = KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM).getPrimitive(RegistryConfiguration.get(), Aead.class);
        wrappedKeyset = TinkJsonProtoKeysetFormat.serializeEncryptedKeyset(dataKeyset, kek, new byte[0]);
        cleartextKeyset = TinkJsonProtoKeysetFormat.serializeKeyset(dataKeyset, InsecureSecretKeyAccess.get());
    }

    private static KmsClient kms(Aead aead) {
        return new KmsClient() {
            @Override
            public boolean doesSupport(String keyUri) {
                return KMS_URI.equals(keyUri);
            }

            @Override
            public KmsClient withCredentials(String credentialPath) {
                return this;
            }

            @Override
            public KmsClient withDefaultCredentials() {
                return this;
            }

            @Override
            public Aead getAead(String keyUri) throws GeneralSecurityException {
                if (!doesSupport(keyUri)) {
                    throw new GeneralSecurityException("unknown key " + keyUri);
                }
                return aead;
            }
        };
    }

    @Test
    void shouldUnwrapTheKeysetThroughKms() {
        runner.withBean(KmsClient.class, () -> kms(kek))
                .withPropertyValues(
                        "security.encryption.keyset=" + wrappedKeyset,
                        "security.encryption.kms-key-uri=" + KMS_URI,
                        "security.encryption.tink-write.enabled=true",
                        "security.encryption.required=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    EncryptionService service = context.getBean(EncryptionService.class);
                    String encrypted = service.encrypt("secret", CONTEXT);
                    assertThat(encrypted).startsWith(EncryptionService.TINK_PREFIX);
                    EncryptionService direct = EncryptionService.withKeyset(dataKeyset, true, null, null);
                    assertThat(direct.decrypt(encrypted, CONTEXT)).isEqualTo("secret");
                });
    }

    @Test
    void shouldFailStartupWhenRequiredAndNoKeyset() {
        runner.withPropertyValues(
                        "security.encryption.required=true",
                        "security.encryption.password=" + PASSWORD,
                        "security.encryption.salt=" + SALT)
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldFailStartupWhenKmsCannotUnwrap() {
        runner.withBean(KmsClient.class, () -> kms(otherKek))
                .withPropertyValues(
                        "security.encryption.keyset=" + wrappedKeyset,
                        "security.encryption.kms-key-uri=" + KMS_URI,
                        "security.encryption.required=true")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldFailStartupWhenKeysetHasNoKmsUri() {
        runner.withBean(KmsClient.class, () -> kms(kek))
                .withPropertyValues(
                        "security.encryption.keyset=" + wrappedKeyset,
                        "security.encryption.required=true")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldRejectCleartextKeysetWithoutExplicitPermission() {
        runner.withPropertyValues(
                        "security.encryption.keyset=" + cleartextKeyset,
                        "security.encryption.required=true")
                .run(context -> assertThat(context).hasFailed());
    }

    @Test
    void shouldAcceptCleartextKeysetWhenExplicitlyAllowed() {
        runner.withPropertyValues(
                        "security.encryption.keyset=" + cleartextKeyset,
                        "security.encryption.cleartext-keyset-allowed=true",
                        "security.encryption.tink-write.enabled=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    EncryptionService service = context.getBean(EncryptionService.class);
                    assertThat(service.decrypt(service.encrypt("secret", CONTEXT), CONTEXT)).isEqualTo("secret");
                });
    }

    @Test
    void shouldKeepLegacyModeWhenNotRequiredAndNoKeyset() {
        runner.withPropertyValues(
                        "security.encryption.password=" + PASSWORD,
                        "security.encryption.salt=" + SALT)
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    EncryptionService service = context.getBean(EncryptionService.class);
                    assertThat(service.isLegacy(service.encrypt("secret", CONTEXT))).isTrue();
                });
    }

    @Test
    void shouldWriteLegacyWhileTinkWriteIsOff() {
        runner.withBean(KmsClient.class, () -> kms(kek))
                .withPropertyValues(
                        "security.encryption.keyset=" + wrappedKeyset,
                        "security.encryption.kms-key-uri=" + KMS_URI,
                        "security.encryption.password=" + PASSWORD,
                        "security.encryption.salt=" + SALT,
                        "security.encryption.required=true")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    EncryptionService service = context.getBean(EncryptionService.class);
                    assertThat(service.isLegacy(service.encrypt("secret", CONTEXT))).isTrue();
                });
    }

    @Test
    void refusesCleartextKeysetWhenRequired() {
        // setup
        EncryptionConfiguration configuration = new EncryptionConfiguration();
        ObjectProvider<KmsClient> noKms = noKmsClient();

        // execution / verifications
        assertThatThrownBy(() -> configuration.encryptionService(
                cleartextKeyset, "", true, true, true, true, PASSWORD, SALT, noKms))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("kms-key-uri");
    }

    @Test
    void legacyReadOffRefusesLegacyValuesButReadsTink() {
        // setup
        EncryptionService service = new EncryptionConfiguration().encryptionService(
                cleartextKeyset, "", true, false, true, false, PASSWORD, SALT, noKmsClient());
        String legacyValue = new EncryptionService(PASSWORD, SALT).encrypt("secret", CONTEXT);

        // execution
        String tinkValue = service.encrypt("secret", CONTEXT);

        // verifications
        assertThat(service.decrypt(tinkValue, CONTEXT)).isEqualTo("secret");
        assertThatThrownBy(() -> service.decrypt(legacyValue, CONTEXT))
                .isInstanceOf(EncryptionException.class);
    }

    @Test
    void legacyReadOffWithTinkWriteOffFailsAtStartup() {
        // setup
        EncryptionConfiguration configuration = new EncryptionConfiguration();
        ObjectProvider<KmsClient> noKms = noKmsClient();

        // execution / verifications
        assertThatThrownBy(() -> configuration.encryptionService(
                cleartextKeyset, "", true, false, false, false, PASSWORD, SALT, noKms))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("legacy-read");
    }

    private static ObjectProvider<KmsClient> noKmsClient() {
        return new StaticListableBeanFactory().getBeanProvider(KmsClient.class);
    }
}
