package com.openframe.management.service;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClientFeatureFlagsService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    // runs on every management start: only a change of the flags starts a rollout
    public void process(Map<String, ClientFeatureFlag> flags) {
        log.info("Processing client feature flags: {}", flags);
        flags.forEach(ClientFeatureFlagsService::requireMinVersionWhenEnabled);
        if (!clientConfigurationService.haveFeatureFlagsMoved(flags)) {
            return;
        }
        if (isClientFeatureFlagsDeliveryEnabled()) {
            rollOut(flags);
        }
        // stored after the hand-off: a crash in between repeats the rollout on the next start, the other order loses it
        clientConfigurationService.updateFeatureFlags(flags);
    }

    private static void requireMinVersionWhenEnabled(String name, ClientFeatureFlag flag) {
        if (flag.isEnabled() && !hasText(flag.getMinVersion())) {
            throw new IllegalStateException("Client feature flag is enabled without min-version: " + name);
        }
    }

    private boolean isClientFeatureFlagsDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS);
    }

    private void rollOut(Map<String, ClientFeatureFlag> flags) {
        ClientFeatureFlagsDeliverySeed everyMachine = ClientFeatureFlagsDeliverySeed.forEveryMachine(flags);
        deliveryDispatcher.dispatch(everyMachine);
        log.info("Client feature flags handed to the delivery engine for every machine: {}", flags);
    }
}
