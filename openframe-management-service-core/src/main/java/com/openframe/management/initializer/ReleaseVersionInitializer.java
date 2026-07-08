package com.openframe.management.initializer;

import com.openframe.management.config.ClientVersionsProperties;
import com.openframe.management.service.ReleaseVersionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Initializes the openframe-client release version from configuration
 * ({@code openframe.client-versions.client}, sourced from the deployed platform image tag) at
 * application startup, instead of relying on the inbound {@code POST /v1/cluster-registrations}
 * endpoint.
 * <p>
 * Delegates to {@link ReleaseVersionService#process(String)} so the full propagation is triggered
 * exactly as it is for the endpoint: the openframe-client configuration version is updated and all
 * IntegratedToolAgents flagged with {@code releaseVersion=true} are bumped to the same version and
 * marked for republish. Runs after {@code IntegratedToolAgentInitializer} (order 20) and
 * {@code OpenFrameClientConfigurationInitializer} (order 30) so the target documents already exist.
 */
@Component
@Order(40)
@RequiredArgsConstructor
@Slf4j
public class ReleaseVersionInitializer implements ApplicationRunner {

    private final ReleaseVersionService releaseVersionService;
    private final ClientVersionsProperties clientVersionsProperties;

    @Override
    public void run(ApplicationArguments args) {
        String clientVersion = clientVersionsProperties.getClient();
        log.info("Initializing release version from configuration: {}", clientVersion);
        releaseVersionService.process(clientVersion);
        log.info("Release version initialized from configuration: {}", clientVersion);
    }
}
