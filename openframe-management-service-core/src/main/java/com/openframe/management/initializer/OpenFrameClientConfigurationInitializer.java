package com.openframe.management.initializer;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
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
        OpenFrameClientConfiguration newConfiguration = objectMapper.readValue(resource.getInputStream(), OpenFrameClientConfiguration.class);
        
        // Set the default ID
        newConfiguration.setId(DEFAULT_ID);
        
        clientConfigurationService.findById(DEFAULT_ID)
            .ifPresentOrElse(
                existingConfiguration ->
                        processExistingConfiguration(existingConfiguration, newConfiguration),
                    () -> processNewConfiguration(newConfiguration)
            );

        log.info("Initialized OpenFrame client configuration");
    }

    private void processExistingConfiguration(
            OpenFrameClientConfiguration existingConfiguration,
            OpenFrameClientConfiguration newConfiguration
    ) {
        log.info("Default OpenFrame client configuration already exists");
        
        // Preserve existing version to prevent overriding
        String existingVersion = existingConfiguration.getVersion();
        newConfiguration.setVersion(existingVersion);
        log.info("Preserving existing version: {}", existingVersion);

        newConfiguration.setPublishState(existingConfiguration.getPublishState());

        clientConfigurationService.save(newConfiguration);
        log.info("Updated existing OpenFrame client configuration");
    }

    private void processNewConfiguration(OpenFrameClientConfiguration newConfiguration) {
        log.info("Found no existing openframe client configuration");
        clientConfigurationService.save(newConfiguration);
        log.info("Updated save new OpenFrame client configuration");
    }
}
