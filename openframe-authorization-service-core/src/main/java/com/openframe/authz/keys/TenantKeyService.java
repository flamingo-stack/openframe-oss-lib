package com.openframe.authz.keys;

import com.nimbusds.jose.jwk.RSAKey;
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

import static java.util.UUID.randomUUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class TenantKeyService {

    private final TenantKeyRepository tenantKeyRepository;
    private final EncryptionService encryptionService;
    private final AuthenticationKeyPairGenerator keyPairGenerator;

    public RSAKey getOrCreateActiveKey(String tenantId) {
        long activeCount = tenantKeyRepository.countByTenantIdAndActiveTrue(tenantId);
        if (activeCount > 1) {
            log.warn("Multiple active signing keys detected for tenantId='{}' (count={}) - this may cause kid mismatches", tenantId, activeCount);
        }

        // Oldest first: with no ordering, a tenant holding two active keys could sign with either one.
        TenantKey doc = tenantKeyRepository.findFirstByTenantIdAndActiveTrueOrderByCreatedAtAsc(tenantId).orElse(null);
        if (doc == null) {
            log.info("No active signing key found for tenantId='{}'. Generating a new key...", tenantId);
            try {
                doc = createAndStore(tenantId);
                log.info("Generated new signing key for tenantId='{}' with kid='{}' createdAt='{}'", tenantId, doc.getKeyId(), doc.getCreatedAt());
            } catch (DuplicateKeyException e) {
                // A concurrent request created the tenant's key first; the unique partial index on
                // (tenantId, active=true) rejected ours, so sign with the winner's key.
                doc = tenantKeyRepository.findFirstByTenantIdAndActiveTrueOrderByCreatedAtAsc(tenantId)
                        .orElseThrow(() -> e);
                log.info("Concurrent signing key creation for tenantId='{}' - using kid='{}'", tenantId, doc.getKeyId());
            }
        } else {
            log.debug("Using active signing key for tenantId='{}' with kid='{}' createdAt='{}'", tenantId, doc.getKeyId(), doc.getCreatedAt());
        }

        RSAPublicKey pub = PemUtil.parsePublicKey(doc.getPublicPem());
        RSAPrivateKey priv = PemUtil.parsePrivateKey(encryptionService.decryptClientSecret(doc.getPrivateEncrypted()));
        return new RSAKey.Builder(pub).privateKey(priv).keyID(doc.getKeyId()).build();
    }

    private TenantKey createAndStore(String tenantId) {
        AuthenticationKeyPair pair = keyPairGenerator.generate();
        String enc = encryptionService.encryptClientSecret(pair.privatePem());
        TenantKey doc = new TenantKey();
        doc.setId(randomUUID().toString());
        doc.setTenantId(tenantId);
        doc.setKeyId(pair.kid());
        doc.setPublicPem(pair.publicPem());
        doc.setPrivateEncrypted(enc);
        doc.setActive(true);
        doc.setCreatedAt(Instant.now());
        tenantKeyRepository.save(doc);
        return doc;
    }
}


