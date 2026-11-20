package com.openframe.core.agentkey;

import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_LOG_KEY;

/**
 * The tenant's agent log key, shared by the api (dashboard install command),
 * the client (agents that registered without one) and management (creates it).
 * The newest key is the current one: rotating adds a key, and the logs gateway
 * only accepts the newest.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentLogKeyService {

    private final AgentLogKeyRepository logKeyRepository;
    private final SecretKeyGenerator keyGenerator;
    private final EncryptionService encryptionService;
    private final TenantIdProvider tenantIdProvider;

    public AgentKeyResponse current() {
        return logKeyRepository.findFirstByOrderByCreatedAtDesc()
                .map(this::reveal)
                .orElseThrow(AgentLogKeyNotFoundException::new);
    }

    public AgentKeyResponse rotate() {
        String plainKey = keyGenerator.generate();
        AgentLogKey savedKey = saveNewKey(plainKey);
        log.info("Rotated agent log key, new key ID: {}", savedKey.getId());
        return new AgentKeyResponse(plainKey, savedKey.getCreatedAt());
    }

    public void createIfMissing() {
        if (logKeyRepository.existsAny()) {
            log.info("Agent log key already exists. Skipping key generation.");
            return;
        }

        AgentLogKey savedKey = saveNewKey(keyGenerator.generate());
        log.info("Generated agent log key with ID: {}", savedKey.getId());
    }

    private AgentLogKey saveNewKey(String plainKey) {
        AgentLogKey logKey = new AgentLogKey();
        EncryptionContext context = context();
        String encryptedKey = encryptionService.encrypt(plainKey, context);
        logKey.setEncryptedKey(encryptedKey);
        logKey.setCreatedAt(Instant.now());
        return logKeyRepository.save(logKey);
    }

    private AgentKeyResponse reveal(AgentLogKey logKey) {
        EncryptionContext context = context();
        String encryptedKey = logKey.getEncryptedKey();
        String plainKey = encryptionService.decrypt(encryptedKey, context);
        return new AgentKeyResponse(plainKey, logKey.getCreatedAt());
    }

    private EncryptionContext context() {
        String tenantId = tenantIdProvider.getTenantId();
        return EncryptionContext.forTenant(tenantId, AGENT_LOG_KEY);
    }

}
