package com.openframe.core.agentkey;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

/**
 * The tenant's agent log key, shared by the api (dashboard install command),
 * the client (agents that registered without one) and management (creates it).
 * The newest key is the current one: rotating adds a key, and the logs gateway
 * only accepts the newest.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentLogKeyService implements AgentKeyProvider {

    private final AgentLogKeyRepository logKeyRepository;
    private final SecretKeyGenerator keyGenerator;
    private final EncryptionService encryptionService;

    @Override
    public AgentKeyType type() {
        return AgentKeyType.LOG;
    }

    @Override
    public AgentKeyResponse current() {
        return getLogKey();
    }

    @Override
    public AgentKeyResponse rotate() {
        String plainKey = keyGenerator.generate();
        AgentLogKey savedKey = saveNewKey(plainKey);
        log.info("Rotated agent log key, new key ID: {}", savedKey.getId());
        return new AgentKeyResponse(plainKey, savedKey.getCreatedAt());
    }

    public AgentKeyResponse getLogKey() {
        return logKeyRepository.findFirstByOrderByCreatedAtDesc()
                .map(logKey -> new AgentKeyResponse(
                        encryptionService.decrypt(logKey.getEncryptedKey()),
                        logKey.getCreatedAt()))
                .orElseThrow(AgentLogKeyNotFoundException::new);
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
        logKey.setEncryptedKey(encryptionService.encrypt(plainKey));
        logKey.setCreatedAt(Instant.now());
        return logKeyRepository.save(logKey);
    }

}
