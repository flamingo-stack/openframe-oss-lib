package com.openframe.management.service;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentLogKeyManagementService {

    private final AgentLogKeyRepository logKeyRepository;
    private final SecretKeyGenerator keyGenerator;
    private final EncryptionService encryptionService;

    public void createInitialLogKey() {
        if (logKeyRepository.existsAny()) {
            log.info("Agent log key already exists. Skipping key generation.");
            return;
        }

        AgentLogKey logKey = buildLogKey();
        AgentLogKey savedKey = logKeyRepository.save(logKey);
        log.info("Generated agent log key with ID: {}", savedKey.getId());
    }

    private AgentLogKey buildLogKey() {
        String plainKey = keyGenerator.generate();
        String encryptedKey = encryptionService.encrypt(plainKey);
        Instant now = Instant.now();

        AgentLogKey logKey = new AgentLogKey();
        logKey.setEncryptedKey(encryptedKey);
        logKey.setCreatedAt(now);
        return logKey;
    }

}
