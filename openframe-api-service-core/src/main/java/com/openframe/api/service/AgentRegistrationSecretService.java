package com.openframe.api.service;

import com.openframe.api.dto.AgentRegistrationSecretResponse;
import com.openframe.api.exception.AgentRegistrationSecretNotFoundException;
import com.openframe.api.service.processor.AgentRegistrationSecretProcessor;
import com.openframe.audit.AuditCall;
import com.openframe.audit.Audited;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.core.exception.ErrorCode;
import com.openframe.core.service.SecretKeyGenerator;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.agent.AgentRegistrationSecret;
import com.openframe.data.repository.agent.AgentRegistrationSecretRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_ROTATE;
import static com.openframe.data.document.audit.AuditAction.AGENT_REGISTRATION_SECRET_VIEW;

@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistrationSecretService {

    private final AgentRegistrationSecretRepository secretRepository;
    private final EncryptionService encryptionService;
    private final SecretKeyGenerator secretGenerator;
    private final AgentRegistrationSecretProcessor secretProcessor;
    private final AuditedMethodRunner auditedMethodRunner;

    @Audited(action = AGENT_REGISTRATION_SECRET_VIEW, details = "secretIds={#result.id}")
    public AgentRegistrationSecretResponse getActiveSecret() {
        return secretRepository.findByActiveTrue()
                .map(secret -> AgentRegistrationSecretResponse.builder()
                        .id(secret.getId())
                        .key(encryptionService.decrypt(secret.getSecretKey()))
                        .createdAt(secret.getCreatedAt())
                        .active(secret.isActive())
                        .build())
                .orElseThrow(() -> new AgentRegistrationSecretNotFoundException(ErrorCode.AGENT_REGISTRATION_SECRET_NOT_FOUND, "Active agent registration secret not found"));
    }

    @Audited(action = AGENT_REGISTRATION_SECRET_VIEW, details = "secretIds=#result.![id]")
    public List<AgentRegistrationSecretResponse> getAllSecrets() {
        List<AgentRegistrationSecret> secrets = secretRepository.findAll();
        return secrets.stream()
                .map(secret -> AgentRegistrationSecretResponse.builder()
                        .id(secret.getId())
                        .key(encryptionService.decrypt(secret.getSecretKey()))
                        .createdAt(secret.getCreatedAt())
                        .active(secret.isActive())
                        .build())
                .toList();
    }

    public AgentRegistrationSecretResponse generateNewSecret() {
        Map<String, Object> details = new HashMap<>();
        AuditCall auditCall = AuditCall.of(AGENT_REGISTRATION_SECRET_ROTATE, null, details).withCompare(false);
        return auditedMethodRunner.run(auditCall, () -> rotate(details));
    }

    private AgentRegistrationSecretResponse rotate(Map<String, Object> auditDetails) {
        auditDetails.put("deactivatedSecretIds", List.of(deactivateExisting()));
        String newSecretKey = secretGenerator.generate();

        AgentRegistrationSecret newSecret = new AgentRegistrationSecret();
        newSecret.setSecretKey(encryptionService.encrypt(newSecretKey));
        newSecret.setCreatedAt(Instant.now());
        newSecret.setActive(true);

        AgentRegistrationSecret savedKey = secretRepository.save(newSecret);
        auditDetails.put("secretIds", List.of(savedKey.getId()));
        log.info("Generated new agent registration secret with ID: {}", savedKey.getId());

        secretProcessor.postProcessSecretGenerated(savedKey, newSecretKey);

        return AgentRegistrationSecretResponse.builder()
                .id(savedKey.getId())
                .key(newSecretKey)
                .createdAt(savedKey.getCreatedAt())
                .active(savedKey.isActive())
                .build();
    }

    private String deactivateExisting() {
        AgentRegistrationSecret activeSecret = secretRepository.findByActiveTrue()
                .orElseThrow(() -> new AgentRegistrationSecretNotFoundException(ErrorCode.NO_ACTIVE_SECRET_FOUND, "Not found active agent secret"));
        activeSecret.setActive(false);
        secretRepository.save(activeSecret);
        log.info("Deactivated previous key with ID: {}", activeSecret.getId());

        secretProcessor.postProcessSecretDeactivated(activeSecret);
        return activeSecret.getId();
    }
}
