package com.openframe.api.service;

import com.openframe.api.dto.ClientConfigurationResponse;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.repository.clientconfiguration.OpenFrameClientConfigurationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class OpenFrameClientConfigurationService {

    private final OpenFrameClientConfigurationRepository clientConfigurationRepository;

    public ClientConfigurationResponse getClientConfiguration() {
        OpenFrameClientConfiguration configuration = clientConfigurationRepository
                .findFirstByOrderByCreatedAtDesc()
                .orElseThrow(() -> new IllegalStateException("Client configuration not found"));
        
        return ClientConfigurationResponse.builder()
                .version(configuration.getVersion())
                .build();
    }
}

