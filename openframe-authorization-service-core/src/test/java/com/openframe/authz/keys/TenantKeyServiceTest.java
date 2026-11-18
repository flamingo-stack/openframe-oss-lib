package com.openframe.authz.keys;

import com.google.crypto.tink.KeysetHandle;
import com.google.crypto.tink.aead.AeadConfig;
import com.google.crypto.tink.aead.PredefinedAeadParameters;
import com.nimbusds.jose.jwk.RSAKey;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.crypto.service.SecretPurpose;
import com.openframe.core.exception.EncryptionException;
import com.openframe.data.document.tenant.TenantKey;
import com.openframe.data.repository.tenant.TenantKeyRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DuplicateKeyException;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class TenantKeyServiceTest {

    private final TenantKeyRepository repository = mock(TenantKeyRepository.class);
    private final EncryptionService encryption = tinkEncryption();
    private final RsaAuthenticationKeyPairGenerator generator = new RsaAuthenticationKeyPairGenerator(properties());
    private final TenantKeyService service = new TenantKeyService(repository, encryption, generator);

    private static EncryptionService tinkEncryption() {
        try {
            AeadConfig.register();
            return EncryptionService.withKeyset(KeysetHandle.generateNew(PredefinedAeadParameters.AES256_GCM), true, null, null);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static EncryptionContext signingKey(String tenantId) {
        return EncryptionContext.forTenant(tenantId, SecretPurpose.TENANT_SIGNING_KEY);
    }

    private static KeyGeneratorProperties properties() {
        KeyGeneratorProperties props = new KeyGeneratorProperties();
        props.setAlgorithm("RSA");
        props.setKeySize(2048);
        props.setSecureRandomAlgorithm("SHA1PRNG");
        return props;
    }

    @Test
    void shouldCreateAndStoreEncryptedKeyOnFirstUse() {
        when(repository.findFirstByTenantIdAndActiveTrue("acme")).thenReturn(Optional.empty());

        RSAKey key = service.getOrCreateActiveKey("acme");

        ArgumentCaptor<TenantKey> saved = ArgumentCaptor.forClass(TenantKey.class);
        verify(repository).save(saved.capture());
        assertThat(saved.getValue().getTenantId()).isEqualTo("acme");
        assertThat(saved.getValue().isActive()).isTrue();
        assertThat(saved.getValue().getKeyId()).startsWith("kid-").isEqualTo(key.getKeyID());
        assertThat(saved.getValue().getPrivateEncrypted()).doesNotContain("PRIVATE KEY");
        assertThat(encryption.decrypt(saved.getValue().getPrivateEncrypted(), signingKey("acme"))).contains("PRIVATE KEY");
        assertThat(key.isPrivate()).isTrue();
    }

    @Test
    void shouldRefuseAKeyEncryptedForAnotherTenant() {
        AuthenticationKeyPair pair = generator.generate();
        TenantKey stolen = new TenantKey();
        stolen.setTenantId("acme");
        stolen.setKeyId(pair.kid());
        stolen.setPublicPem(pair.publicPem());
        stolen.setPrivateEncrypted(encryption.encrypt(pair.privatePem(), signingKey("globex")));
        stolen.setActive(true);
        when(repository.findFirstByTenantIdAndActiveTrue("acme")).thenReturn(Optional.of(stolen));

        assertThatThrownBy(() -> service.getOrCreateActiveKey("acme")).isInstanceOf(EncryptionException.class);
    }

    @Test
    void shouldUseTheWinnersKeyWhenAnotherPodCreatedOneConcurrently() {
        // after the legacy keys are retired every tenant's key is recreated on first use, on every auth-server
        // replica at once; the unique (tenantId, active) index lets one insert win and the loser must reuse it
        AuthenticationKeyPair winner = generator.generate();
        TenantKey stored = new TenantKey();
        stored.setTenantId("acme");
        stored.setKeyId(winner.kid());
        stored.setPublicPem(winner.publicPem());
        stored.setPrivateEncrypted(encryption.encrypt(winner.privatePem(), signingKey("acme")));
        stored.setActive(true);
        when(repository.findFirstByTenantIdAndActiveTrue("acme")).thenReturn(Optional.empty(), Optional.of(stored));
        when(repository.save(any(TenantKey.class))).thenThrow(new DuplicateKeyException("tenant_keys_tenant_active_unique"));

        RSAKey key = service.getOrCreateActiveKey("acme");

        assertThat(key.getKeyID()).isEqualTo(winner.kid());
    }

    @Test
    void shouldReuseStoredKeyWithStableKid() throws Exception {
        AuthenticationKeyPair pair = generator.generate();
        TenantKey stored = new TenantKey();
        stored.setTenantId("acme");
        stored.setKeyId(pair.kid());
        stored.setPublicPem(pair.publicPem());
        stored.setPrivateEncrypted(encryption.encrypt(pair.privatePem(), signingKey("acme")));
        stored.setActive(true);
        when(repository.findFirstByTenantIdAndActiveTrue("acme")).thenReturn(Optional.of(stored));

        RSAKey first = service.getOrCreateActiveKey("acme");
        RSAKey second = service.getOrCreateActiveKey("acme");

        assertThat(first.getKeyID()).isEqualTo(pair.kid()).isEqualTo(second.getKeyID());
        assertThat(first.toRSAPublicKey()).isEqualTo(pair.publicKey());
        verify(repository, never()).save(any());
    }

    @Test
    void shouldRoundTripPemEncoding() {
        AuthenticationKeyPair pair = generator.generate();

        assertThat(PemUtil.parsePublicKey(pair.publicPem())).isEqualTo(pair.publicKey());
        assertThat(PemUtil.parsePrivateKey(pair.privatePem())).isEqualTo(pair.privateKey());
        assertThatThrownBy(() -> PemUtil.parsePublicKey("garbage")).hasMessage("Invalid public key PEM");
        assertThatThrownBy(() -> PemUtil.parsePrivateKey("garbage")).hasMessage("Invalid private key PEM");
    }
}
