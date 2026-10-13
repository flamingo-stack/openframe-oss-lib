package com.openframe.management.service;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClientFeatureFlagsService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    // runs on every management start: only a change of the flags starts a rollout
    public void process(Map<String, Boolean> flags) {
        log.info("Processing client feature flags: {}", flags);
        boolean flagsMoved = clientConfigurationService.updateFeatureFlags(flags);
        if (flagsMoved && isClientFeatureFlagsDeliveryEnabled()) {
            rollOut(flags);
        }
    }

    private boolean isClientFeatureFlagsDeliveryEnabled() {
        return deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS);
    }

    private void rollOut(Map<String, Boolean> flags) {
        ClientFeatureFlagsDeliverySeed everyMachine = ClientFeatureFlagsDeliverySeed.forEveryMachine(flags);
        deliveryDispatcher.dispatch(everyMachine);
        log.info("Client feature flags handed to the delivery engine for every machine: {}", flags);
    }
}
