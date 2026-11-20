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
        secretRepository.findByActiveTrue().ifPresent(this::deactivate);
        String secretKey = secretGenerator.generate();
        AgentRegistrationSecret savedKey = saveNewActiveSecret(secretKey);
        log.info("Rotated agent registration key, new key ID: {}", savedKey.getId());
        return savedKey;
    }

    private void deactivate(AgentRegistrationSecret active) {
        active.setActive(false);
        secretRepository.save(active);
        log.info("Deactivated agent registration key with ID: {}", active.getId());
    }

    private AgentRegistrationSecret saveNewActiveSecret(String secretKey) {
        String tenantId = tenantIdProvider.getTenantId();
        EncryptionContext context = EncryptionContext.forTenant(tenantId, AGENT_REGISTRATION_SECRET);
        String encryptedSecretKey = encryptionService.encrypt(secretKey, context);
        Instant createdAt = Instant.now();
        AgentRegistrationSecret secret = new AgentRegistrationSecret();
        secret.setSecretKey(encryptedSecretKey);
        secret.setCreatedAt(createdAt);
        secret.setActive(true);
        return secretRepository.save(secret);
    }
}
