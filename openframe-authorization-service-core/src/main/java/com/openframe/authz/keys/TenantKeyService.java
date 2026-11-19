package com.openframe.authz.keys;

import com.nimbusds.jose.jwk.RSAKey;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.tenant.TenantKey;
import com.openframe.data.repository.tenant.TenantKeyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;

import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;

import static com.openframe.core.crypto.service.SecretPurpose.TENANT_SIGNING_KEY;
import static java.util.UUID.randomUUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantKeyService {

    private final TenantKeyRepository tenantKeyRepository;
    private final EncryptionService encryptionService;
    private final AuthenticationKeyPairGenerator keyPairGenerator;

    public RSAKey getOrCreateActiveKey(String tenantId) {
        TenantKey doc = tenantKeyRepository.findFirstByTenantIdAndActiveTrue(tenantId).orElse(null);
        if (doc == null) {
            log.info("No active signing key found for tenantId='{}'. Generating a new key...", tenantId);
            doc = createAndStore(tenantId);
            log.info("Generated new signing key for tenantId='{}' with kid='{}' createdAt='{}'", tenantId, doc.getKeyId(), doc.getCreatedAt());
        } else {
            log.debug("Using active signing key for tenantId='{}' with kid='{}' createdAt='{}'", tenantId, doc.getKeyId(), doc.getCreatedAt());
        }

        RSAPublicKey pub = PemUtil.parsePublicKey(doc.getPublicPem());
        String privateEncrypted = doc.getPrivateEncrypted();
        EncryptionContext context = context(tenantId);
        String privatePem = encryptionService.decrypt(privateEncrypted, context);
        RSAPrivateKey priv = PemUtil.parsePrivateKey(privatePem);
        return new RSAKey.Builder(pub).privateKey(priv).keyID(doc.getKeyId()).build();
    }

    private TenantKey createAndStore(String tenantId) {
        AuthenticationKeyPair pair = keyPairGenerator.generate();
        String privatePem = pair.privatePem();
        EncryptionContext context = context(tenantId);
        String enc = encryptionService.encrypt(privatePem, context);
        TenantKey doc = new TenantKey();
        doc.setId(randomUUID().toString());
        doc.setTenantId(tenantId);
        doc.setKeyId(pair.kid());
        doc.setPublicPem(pair.publicPem());
        doc.setPrivateEncrypted(enc);
        doc.setActive(true);
        doc.setCreatedAt(Instant.now());
        try {
            tenantKeyRepository.save(doc);
            return doc;
        } catch (DuplicateKeyException e) {
            // another replica created the tenant's active key first (unique tenantId+active index): use theirs
            log.info("Signing key for tenantId='{}' was created concurrently, using the stored one", tenantId);
            return tenantKeyRepository.findFirstByTenantIdAndActiveTrue(tenantId).orElseThrow(() -> e);
        }
    }

    private static EncryptionContext context(String tenantId) {
        return EncryptionContext.forTenant(tenantId, TENANT_SIGNING_KEY);
    }
}


