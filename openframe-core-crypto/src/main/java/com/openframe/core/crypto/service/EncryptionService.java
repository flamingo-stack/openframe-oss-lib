package com.openframe.core.crypto.service;

import com.google.crypto.tink.Aead;
import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.RegistryConfiguration;
import com.google.crypto.tink.aead.AeadConfig;
import com.openframe.core.exception.EncryptionException;
import com.openframe.core.exception.ErrorCode;
import org.springframework.security.crypto.encrypt.Encryptors;
import org.springframework.security.crypto.encrypt.TextEncryptor;

import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.util.Base64;

/**
 * Encrypts secrets stored in Mongo with Tink AEAD (AES-256-GCM), bound to an {@link EncryptionContext}.
 * Values written before Tink (AES-CBC under the password from config) carry no {@link #TINK_PREFIX} and are
 * read with that legacy password only. Without a keyset the service runs in that legacy mode alone.
 */
public class EncryptionService {

    public static final String TINK_PREFIX = "tk1:";
    private static final int TINK_PREFIX_LENGTH = TINK_PREFIX.length();

    private final TextEncryptor legacy;
    private final Aead aead;
    private final boolean tinkWrite;

    public EncryptionService(String legacyPassword, String legacySalt) {
        this(legacyEncryptor(legacyPassword, legacySalt), null, false);
    }

    private EncryptionService(TextEncryptor legacy, Aead aead, boolean tinkWrite) {
        this.legacy = legacy;
        this.aead = aead;
        this.tinkWrite = tinkWrite;
    }

    public static EncryptionService withKeyset(KeysetHandle keyset, boolean tinkWrite,
                                               String legacyPassword, String legacySalt) {
        if (keyset == null) {
            throw new IllegalArgumentException("Encryption keyset is required");
        }
        TextEncryptor legacy = legacyPassword == null && legacySalt == null
                ? null
                : legacyEncryptor(legacyPassword, legacySalt);
        if (!tinkWrite && legacy == null) {
            throw new IllegalArgumentException("Writing the legacy format needs the legacy password and salt");
        }
        return new EncryptionService(legacy, primitive(keyset), tinkWrite);
    }

    public String encrypt(String plainText, EncryptionContext context) {
        requireText(plainText, "Plain text");
        requireContext(context);
        if (!tinkWrite) {
            return encryptLegacy(plainText);
        }
        return encryptTink(plainText, context);
    }

    public String decrypt(String ciphertext, EncryptionContext context) {
        requireText(ciphertext, "Encrypted text");
        requireContext(context);
        return isLegacy(ciphertext) ? decryptLegacy(ciphertext) : decryptTink(ciphertext, context);
    }

    /** Whether {@link #encrypt} produces Tink values; migrations decide by this, not by the flag. */
    public boolean writesTink() {
        return tinkWrite;
    }

    public boolean isLegacy(String ciphertext) {
        return !ciphertext.startsWith(TINK_PREFIX);
    }

    /** Rewrites a legacy value as Tink under the given context; a Tink value comes back as is. */
    public String reencrypt(String ciphertext, EncryptionContext context) {
        if (aead == null) {
            throw new IllegalStateException("Re-encryption needs an encryption keyset");
        }
        if (!isLegacy(ciphertext)) {
            return ciphertext;
        }
        String plainText = decrypt(ciphertext, context);
        return encryptTink(plainText, context);
    }

    private String encryptTink(String plainText, EncryptionContext context) {
        try {
            byte[] plainBytes = plainText.getBytes(StandardCharsets.UTF_8);
            byte[] associatedData = context.associatedData();
            byte[] sealed = aead.encrypt(plainBytes, associatedData);
            return TINK_PREFIX + Base64.getEncoder().encodeToString(sealed);
        } catch (GeneralSecurityException e) {
            throw new EncryptionException(ErrorCode.ENCRYPTION_FAILED, "Failed to encrypt sensitive data", e);
        }
    }

    private String decryptTink(String ciphertext, EncryptionContext context) {
        if (aead == null) {
            throw new EncryptionException(ErrorCode.DECRYPTION_FAILED, "No encryption keyset to decrypt a Tink value");
        }
        try {
            String encoded = ciphertext.substring(TINK_PREFIX_LENGTH);
            byte[] sealed = Base64.getDecoder().decode(encoded);
            byte[] associatedData = context.associatedData();
            byte[] plainBytes = aead.decrypt(sealed, associatedData);
            return new String(plainBytes, StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            throw new EncryptionException(ErrorCode.DECRYPTION_FAILED, "Failed to decrypt sensitive data", e);
        }
    }

    private String encryptLegacy(String plainText) {
        try {
            return legacy.encrypt(plainText);
        } catch (RuntimeException e) {
            throw new EncryptionException(ErrorCode.ENCRYPTION_FAILED, "Failed to encrypt sensitive data", e);
        }
    }

    private String decryptLegacy(String ciphertext) {
        if (legacy == null) {
            throw new EncryptionException(ErrorCode.DECRYPTION_FAILED,
                    "Cannot decrypt a legacy value: no legacy password configured");
        }
        try {
            return legacy.decrypt(ciphertext);
        } catch (RuntimeException e) {
            throw new EncryptionException(ErrorCode.DECRYPTION_FAILED, "Failed to decrypt a legacy value", e);
        }
    }

    private static TextEncryptor legacyEncryptor(String password, String salt) {
        if (password == null || password.length() < 32) {
            throw new IllegalArgumentException("Encryption password must be at least 32 characters");
        }
        if (salt == null || salt.length() < 16) {
            throw new IllegalArgumentException("Encryption salt must be at least 16 characters (hex-encoded)");
        }
        return Encryptors.text(password, salt);
    }

    private static Aead primitive(KeysetHandle keyset) {
        try {
            AeadConfig.register();
            return keyset.getPrimitive(RegistryConfiguration.get(), Aead.class);
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Could not initialize the encryption keyset", e);
        }
    }

    private static void requireText(String value, String name) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(name + " cannot be null or empty");
        }
    }

    private static void requireContext(EncryptionContext context) {
        if (context == null) {
            throw new IllegalArgumentException("Encryption context is required");
        }
    }
}
