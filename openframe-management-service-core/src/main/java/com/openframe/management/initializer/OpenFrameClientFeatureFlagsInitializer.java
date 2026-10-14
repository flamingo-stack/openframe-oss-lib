package com.openframe.management.initializer;

import com.openframe.management.config.ClientFeatureFlagsProperties;
import com.openframe.management.service.ClientFeatureFlagsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.util.Map;

// after OpenFrameClientVersionInitializer (40): the configuration document the flags live in exists by then
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class OpenFrameClientFeatureFlagsInitializer implements ApplicationRunner {

    private final ClientFeatureFlagsService clientFeatureFlagsService;
    private final ClientFeatureFlagsProperties clientFeatureFlagsProperties;

    @Override
    public void run(ApplicationArguments args) {
        Map<String, Boolean> flags = clientFeatureFlagsProperties.getFeatureFlags();
        clientFeatureFlagsService.process(flags);
        log.info("Client feature flags initialized from configuration: {}", flags);
    }
}
