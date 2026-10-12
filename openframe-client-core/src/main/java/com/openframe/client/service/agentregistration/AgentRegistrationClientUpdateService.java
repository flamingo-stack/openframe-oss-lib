package com.openframe.client.service.agentregistration;

import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

// a machine that registers gets the current client version as a delivery, whatever it was installed from: a rollout
// that ran before it existed never reaches it, and the agent answers DONE at once when it already runs that version
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistrationClientUpdateService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryDispatcher deliveryDispatcher;

    public void process(String machineId) {
        if (!deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)) {
            return;
        }
        try {
            OpenFrameClientConfiguration configuration = clientConfigurationService.get();
            deliveryDispatcher.dispatch(ClientUpdateDeliverySeed.forMachine(machineId, configuration));
        } catch (RuntimeException e) {
            // the registration itself must not fail on this: the next release reaches the machine anyway
            log.error("Failed to hand the client update to the delivery engine on registration: machineId={}", machineId, e);
        }
    }
}
