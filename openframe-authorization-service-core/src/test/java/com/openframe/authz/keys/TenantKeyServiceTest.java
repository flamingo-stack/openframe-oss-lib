package com.openframe.authz.keys;

import com.nimbusds.jose.jwk.RSAKey;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.tenant.TenantKey;
import com.openframe.data.repository.tenant.TenantKeyRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

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
    private final EncryptionService encryption = new EncryptionService("0123456789abcdef0123456789abcdef", "0123456789abcdef");
    private final RsaAuthenticationKeyPairGenerator generator = new RsaAuthenticationKeyPairGenerator(properties());
    private final TenantKeyService service = new TenantKeyService(repository, encryption, generator);

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
        assertThat(key.isPrivate()).isTrue();
    }

    @Test
    void shouldReuseStoredKeyWithStableKid() throws Exception {
        AuthenticationKeyPair pair = generator.generate();
        TenantKey stored = new TenantKey();
        stored.setTenantId("acme");
        stored.setKeyId(pair.kid());
        stored.setPublicPem(pair.publicPem());
        stored.setPrivateEncrypted(encryption.encryptClientSecret(pair.privatePem()));
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
