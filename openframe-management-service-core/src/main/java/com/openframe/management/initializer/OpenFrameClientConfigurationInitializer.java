package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;

import static com.openframe.data.service.OpenFrameClientConfigurationService.DEFAULT_ID;

@Component
@RequiredArgsConstructor
@Slf4j
public class OpenFrameClientConfigurationInitializer {

    private static final String CONFIG_FILE = "agent-configurations/client-configuration.json";

    private final ObjectMapper objectMapper;
    private final OpenFrameClientConfigurationService clientConfigurationService;

    @PostConstruct
    public void init() throws IOException {
        log.info("Initializing OpenFrame client configuration");
        ClassPathResource resource = new ClassPathResource(CONFIG_FILE);
        OpenFrameClientConfiguration fromConfig = objectMapper.readValue(resource.getInputStream(), OpenFrameClientConfiguration.class);
        fromConfig.setId(DEFAULT_ID);

        clientConfigurationService.updateConfigurationFields(fromConfig);

        log.info("Initialized OpenFrame client configuration");
    }
}
