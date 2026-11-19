package com.openframe.management.service;

import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.management.service.processor.AgentRegistrationSecretManagementProcessor;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentRegistrationSecretManagementService {

    private final AgentRegistrationSecretRepository secretRepository;
    private final SecretKeyGenerator secretGenerator;
    private final EncryptionService encryptionService;
    private final AgentRegistrationSecretManagementProcessor secretProcessor;
    private final TenantIdProvider tenantIdProvider;

    public void createInitialSecret() {
        if (secretRepository.existsAny()) {
            log.info("Agent registration keys already exist. Skipping key generation.");
            return;
        }

        String secretKey = secretGenerator.generate();
        AgentRegistrationSecret savedKey = saveNewActiveSecret(secretKey);
        log.info("Generated new agent registration key with ID: {}", savedKey.getId());

        secretProcessor.postProcessInitialSecretCreated(savedKey, secretKey);
    }

    public AgentRegistrationSecret rotateSecret() {
        secretRepository.findByActiveTrue().ifPresent(active -> {
            active.setActive(false);
            secretRepository.save(active);
            log.info("Deactivated agent registration key with ID: {}", active.getId());
        });
        AgentRegistrationSecret savedKey = saveNewActiveSecret(secretGenerator.generate());
        log.info("Rotated agent registration key, new key ID: {}", savedKey.getId());
        return savedKey;
    }

    private AgentRegistrationSecret saveNewActiveSecret(String secretKey) {
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setSecretKey(encryptionService.encrypt(secretKey,
                EncryptionContext.forTenant(tenantIdProvider.getTenantId(), AGENT_REGISTRATION_SECRET)));
        secret.setCreatedAt(Instant.now());
        secret.setActive(true);
        return secretRepository.save(secret);
    }
}
