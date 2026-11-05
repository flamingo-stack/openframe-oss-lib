package com.openframe.management.initializer;

import java.util.Map;
import tools.jackson.databind.ObjectMapper;
import com.openframe.audit.AuditCapture;
import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;

import static com.openframe.data.document.audit.AuditAction.DEVICE_CLIENT_UPDATE;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

@Component
@Order(30)
@RequiredArgsConstructor
@Slf4j
public class OpenFrameClientConfigurationInitializer implements ApplicationRunner {

    private static final String CONFIG_FILE = "agent-configurations/client-configuration.json";

    private final ObjectMapper objectMapper;
    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final AuditCapture auditCapture;
    private final AuditRecorder auditRecorder;

    @Override
    public void run(ApplicationArguments args) throws IOException {
        log.info("Initializing OpenFrame client configuration");
        ClassPathResource resource = new ClassPathResource(CONFIG_FILE);
        OpenFrameClientConfiguration fromConfig = objectMapper.readValue(resource.getInputStream(), OpenFrameClientConfiguration.class);

        auditCapture.runWhenChanged(DEVICE_CLIENT_UPDATE, DEVICE, null, Map.of("change", "downloadConfiguration"),
                () -> clientConfigurationService.updateConfigurationFields(fromConfig, auditRecorder.currentEventId()));

        log.info("Initialized OpenFrame client configuration");
    }
}
