package com.openframe.client.service.agentregistration;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditCapture;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.delivery.ClientUpdateDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import com.openframe.delivery.config.DeliveryProperties;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import static com.openframe.data.document.audit.AuditAction.DEVICE_CLIENT_UPDATE;
import static com.openframe.data.document.audit.AuditTargetType.DEVICE;

// a machine that registers gets the current client version as a delivery, whatever it was installed from: a rollout
// that ran before it existed never reaches it, and the agent answers DONE at once when it already runs that version
@Slf4j
@Service
@RequiredArgsConstructor
public class AgentRegistrationClientUpdateService {

    private final OpenFrameClientConfigurationService clientConfigurationService;
    private final DeliveryProperties deliveryProperties;
    private final DeliveryRouter deliveryRouter;
    private final AuditCapture auditCapture;

    public void process(String machineId) {
        if (!deliveryProperties.isEnabled(DeliveryType.CLIENT_UPDATE)) {
            return;
        }
        try {
            OpenFrameClientConfiguration configuration = clientConfigurationService.get();
            ClientUpdateDeliverySeed seed = ClientUpdateDeliverySeed.forMachine(machineId, configuration);
            AuditCall call = AuditCall.of(DEVICE_CLIENT_UPDATE, DEVICE, machineId, Map.of())
                    .withCompare(false)
                    .withDetailsFromResult(carried -> Map.of("version", configuration.getVersion(), "carried", carried));
            auditCapture.capture(call, () -> deliveryRouter.dispatch(seed));
        } catch (RuntimeException e) {
            // the registration itself must not fail on this: the next release reaches the machine anyway
            log.error("Failed to send the client update on registration: machineId={}", machineId, e);
        }
    }
}
