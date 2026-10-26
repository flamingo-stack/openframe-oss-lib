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
 * One key per tenant, never rotated.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentLogKeyService {

    private final AgentLogKeyRepository logKeyRepository;
    private final SecretKeyGenerator keyGenerator;
    private final EncryptionService encryptionService;

    public AgentLogKeyResponse getLogKey() {
        return logKeyRepository.findFirstByOrderByCreatedAtDesc()
                .map(logKey -> new AgentLogKeyResponse(
                        encryptionService.decrypt(logKey.getEncryptedKey()),
                        logKey.getCreatedAt()))
                .orElseThrow(AgentLogKeyNotFoundException::new);
    }

    public void createIfMissing() {
        if (logKeyRepository.existsAny()) {
            log.info("Agent log key already exists. Skipping key generation.");
            return;
        }

        AgentLogKey logKey = new AgentLogKey();
        logKey.setEncryptedKey(encryptionService.encrypt(keyGenerator.generate()));
        logKey.setCreatedAt(Instant.now());

        AgentLogKey savedKey = logKeyRepository.save(logKey);
        log.info("Generated agent log key with ID: {}", savedKey.getId());
    }

}
