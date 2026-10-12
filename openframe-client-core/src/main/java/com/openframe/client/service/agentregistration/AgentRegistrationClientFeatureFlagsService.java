package com.openframe.client.service.agentregistration;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Map;

import static java.util.Objects.requireNonNullElse;

// a machine that registers gets the tenant's current flags as a delivery: a rollout that ran before it existed never
// reaches it, and an agent holding the same set answers DONE at once
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistrationClientFeatureFlagsService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    public void process(String machineId) {
        if (!deliveryProperties.isEnabled(DeliveryType.CLIENT_FEATURE_FLAGS)) {
            return;
        }
        try {
            OpenFrameClientConfiguration configuration = clientConfigurationService.get();
            Map<String, Boolean> flags = requireNonNullElse(configuration.getFeatureFlags(), Map.of());
            deliveryDispatcher.dispatch(ClientFeatureFlagsDeliverySeed.forMachine(machineId, flags));
        } catch (RuntimeException e) {
            // the registration itself must not fail on this: the next release reaches the machine anyway
            log.error("Failed to hand the client feature flags to the delivery engine on registration: machineId={}", machineId, e);
        }
    }
}
