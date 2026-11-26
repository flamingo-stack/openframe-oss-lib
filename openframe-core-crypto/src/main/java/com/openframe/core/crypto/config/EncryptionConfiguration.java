package com.openframe.core.crypto.config;

import com.google.crypto.tink.Aead;
import com.google.crypto.tink.InsecureSecretKeyAccess;
import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.KmsClient;
import com.google.crypto.tink.TinkJsonProtoKeysetFormat;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.integration.gcpkms.GcpKmsClient;
import com.openframe.core.crypto.service.EncryptionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.util.StringUtils;

import java.security.GeneralSecurityException;

/**
 * Builds {@link EncryptionService}. With {@code security.encryption.keyset} it decrypts the keyset through
 * Cloud KMS ({@code kms-key-uri}); a cleartext keyset is accepted only with {@code cleartext-keyset-allowed},
 * for local runs and tests, never with {@code required}. Without a keyset it stays in the legacy mode, unless
 * {@code required} or {@code tink-write.enabled} is set. {@code legacy-read.enabled=false} drops the legacy
 * password, so unmarked values are refused.
 */
@Slf4j
@Configuration
public class EncryptionConfiguration {

    private static final byte[] NO_ASSOCIATED_DATA = new byte[0];

    @Bean
    public EncryptionService encryptionService(
            @Value("${security.encryption.keyset:}") String keyset,
            @Value("${security.encryption.kms-key-uri:}") String kmsKeyUri,
            @Value("${security.encryption.cleartext-keyset-allowed:false}") boolean cleartextAllowed,
            @Value("${security.encryption.required:false}") boolean required,
            @Value("${security.encryption.tink-write.enabled:false}") boolean tinkWrite,
            @Value("${security.encryption.legacy-read.enabled:true}") boolean legacyRead,
            @Value("${security.encryption.password:}") String legacyPassword,
            @Value("${security.encryption.salt:}") String legacySalt,
            ObjectProvider<KmsClient> kmsClient) {
        if (!StringUtils.hasText(keyset)) {
            if (required) {
                throw new IllegalStateException("security.encryption.keyset is required but not set");
            }
            if (tinkWrite) {
                throw new IllegalStateException(
                        "security.encryption.tink-write.enabled=true needs security.encryption.keyset");
            }
            log.warn("No encryption keyset configured: running in the legacy encryption mode");
            return new EncryptionService(legacyPassword, legacySalt);
        }
        if (!legacyRead && !tinkWrite) {
            throw new IllegalStateException(
                    "security.encryption.legacy-read.enabled=false needs security.encryption.tink-write.enabled=true");
        }
        KeysetHandle handle = loadKeyset(keyset, kmsKeyUri, cleartextAllowed && !required, kmsClient);
        log.info("Encryption keyset loaded; Tink writes {}, legacy reads {}", onOff(tinkWrite), onOff(legacyRead));
        if (!legacyRead) {
            return EncryptionService.withKeyset(handle, true, null, null);
        }
        String password = blankToNull(legacyPassword);
        String salt = blankToNull(legacySalt);
        return EncryptionService.withKeyset(handle, tinkWrite, password, salt);
    }

    private static KeysetHandle loadKeyset(String keyset, String kmsKeyUri, boolean cleartextAllowed,
                                           ObjectProvider<KmsClient> kmsClient) {
        try {
            AeadConfig.register();
            if (StringUtils.hasText(kmsKeyUri)) {
                KmsClient client = kmsClient.getIfAvailable(() -> gcpKmsClient(kmsKeyUri));
                Aead keysetEncryptionAead = client.getAead(kmsKeyUri);
                return TinkJsonProtoKeysetFormat.parseEncryptedKeyset(keyset, keysetEncryptionAead, NO_ASSOCIATED_DATA);
            }
            if (cleartextAllowed) {
                log.warn("Using a cleartext encryption keyset: local and test runs only");
                return TinkJsonProtoKeysetFormat.parseKeyset(keyset, InsecureSecretKeyAccess.get());
            }
            throw new IllegalStateException(
                    "security.encryption.kms-key-uri is required to decrypt the encryption keyset");
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not load the encryption keyset", e);
        }
    }

    private static KmsClient gcpKmsClient(String kmsKeyUri) {
        try {
            return new GcpKmsClient(kmsKeyUri).withDefaultCredentials();
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not create the Cloud KMS client", e);
        }
    }

    private static String onOff(boolean value) {
        return value ? "on" : "off";
    }

    private static String blankToNull(String value) {
        return StringUtils.hasText(value) ? value : null;
    }
}
