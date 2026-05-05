package com.openframe.management.service;

import com.openframe.data.document.apikey.ApiKey;
import com.openframe.data.repository.apikey.ApiKeyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ApiKeyExpirationService {

    private final ApiKeyRepository apiKeyRepository;

    public int disableExpiredKeys() {
        List<ApiKey> expiredKeys = apiKeyRepository.findExpiredKeys(Instant.now());
        for (ApiKey key : expiredKeys) {
            key.setEnabled(false);
            key.setUpdatedAt(Instant.now());
            apiKeyRepository.save(key);
            log.info("Disabled expired API key: {}", key.getKeyId());
        }
        log.info("API key expiration sweep complete. Disabled {} keys.", expiredKeys.size());
        return expiredKeys.size();
    }
}
