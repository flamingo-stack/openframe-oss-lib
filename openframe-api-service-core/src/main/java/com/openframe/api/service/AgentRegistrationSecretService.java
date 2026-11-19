package com.openframe.api.service;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.api.exception.AgentRegistrationSecretNotFoundException;
import com.openframe.api.service.processor.AgentRegistrationSecretProcessor;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

import static com.openframe.core.crypto.service.SecretPurpose.AGENT_REGISTRATION_SECRET;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistrationSecretService {

    private final AgentRegistrationSecretRepository secretRepository;
    private final EncryptionService encryptionService;
    private final SecretKeyGenerator secretGenerator;
    private final AgentRegistrationSecretProcessor secretProcessor;
    private final TenantIdProvider tenantIdProvider;

    public AgentRegistrationSecretResponse getActiveSecret() {
        return secretRepository.findByActiveTrue()
                .map(secret -> AgentRegistrationSecretResponse.builder()
                        .id(secret.getId())
                        .key(encryptionService.decrypt(secret.getSecretKey(), context()))
                        .createdAt(secret.getCreatedAt())
                        .active(secret.isActive())
                        .build())
                .orElseThrow(() -> new AgentRegistrationSecretNotFoundException(ErrorCode.AGENT_REGISTRATION_SECRET_NOT_FOUND, "Active agent registration secret not found"));
    }

    public List<AgentRegistrationSecretResponse> getAllSecrets() {
        List<AgentRegistrationSecret> secrets = secretRepository.findAll();
        return secrets.stream()
                .map(secret -> AgentRegistrationSecretResponse.builder()
                        .id(secret.getId())
                        .key(encryptionService.decrypt(secret.getSecretKey(), context()))
                        .createdAt(secret.getCreatedAt())
                        .active(secret.isActive())
                        .build())
                .toList();
    }

    public AgentRegistrationSecretResponse generateNewSecret() {
        deactivateExisting();
        String newSecretKey = secretGenerator.generate();

        AgentRegistrationSecret newSecret = new AgentRegistrationSecret();
        newSecret.setSecretKey(encryptionService.encrypt(newSecretKey, context()));
        newSecret.setCreatedAt(Instant.now());
        newSecret.setActive(true);

        AgentRegistrationSecret savedKey = secretRepository.save(newSecret);
        log.info("Generated new agent registration secret with ID: {}", savedKey.getId());

        secretProcessor.postProcessSecretGenerated(savedKey, newSecretKey);

        return AgentRegistrationSecretResponse.builder()
                .id(savedKey.getId())
                .key(newSecretKey)
                .createdAt(savedKey.getCreatedAt())
                .active(savedKey.isActive())
                .build();
    }

    private void deactivateExisting() {
        AgentRegistrationSecret activeSecret = secretRepository.findByActiveTrue()
                .orElseThrow(() -> new AgentRegistrationSecretNotFoundException(ErrorCode.NO_ACTIVE_SECRET_FOUND, "Not found active agent secret"));
        activeSecret.setActive(false);
        secretRepository.save(activeSecret);
        log.info("Deactivated previous key with ID: {}", activeSecret.getId());

        secretProcessor.postProcessSecretDeactivated(activeSecret);
    }

    private EncryptionContext context() {
        return EncryptionContext.forTenant(tenantIdProvider.getTenantId(), AGENT_REGISTRATION_SECRET);
    }
}
