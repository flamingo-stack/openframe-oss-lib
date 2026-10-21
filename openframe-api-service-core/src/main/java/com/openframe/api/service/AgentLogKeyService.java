package com.openframe.api.service;

import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.core.exception.AgentLogKeyNotFoundException;
import com.openframe.data.document.agent.AgentLogKey;
import com.openframe.data.repository.agent.AgentLogKeyRepository;
import com.openframe.api.dto.AgentLogKeyResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class AgentLogKeyService {

    private final AgentLogKeyRepository logKeyRepository;
    private final EncryptionService encryptionService;

    public AgentLogKeyResponse getLogKey() {
        AgentLogKey logKey = logKeyRepository.findFirstByOrderByCreatedAtDesc()
                .orElseThrow(AgentLogKeyNotFoundException::new);
        String encryptedKey = logKey.getEncryptedKey();
        String plainKey = encryptionService.decrypt(encryptedKey);
        Instant createdAt = logKey.getCreatedAt();

        return AgentLogKeyResponse.builder()
                .key(plainKey)
                .createdAt(createdAt)
                .build();
    }

}
