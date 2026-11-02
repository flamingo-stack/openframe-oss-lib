package com.openframe.management.service;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.nats.delivery.ClientFeatureFlagsDeliverySeed;
import com.openframe.data.nats.delivery.route.DeliveryRouter;
import com.openframe.data.service.OpenFrameClientConfigurationService;
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
    private final DeliveryRouter deliveryRouter;

    // runs on every management start: only a change of the flags starts a rollout
    public void process(Map<String, ClientFeatureFlag> flags) {
        log.info("Processing client feature flags: {}", flags);
        flags.forEach(ClientFeatureFlagsService::requireMinVersionWhenEnabled);
        if (!clientConfigurationService.haveFeatureFlagsMoved(flags)) {
            return;
        }
        rollOut(flags);
        // stored after the hand-off: a crash in between repeats the rollout on the next start, the other order loses it
        clientConfigurationService.updateFeatureFlags(flags);
    }

    private static void requireMinVersionWhenEnabled(String name, ClientFeatureFlag flag) {
        if (flag.isEnabled() && !hasText(flag.getMinVersion())) {
            throw new IllegalStateException("Client feature flag is enabled without min-version: " + name);
        }
    }

    private void rollOut(Map<String, ClientFeatureFlag> flags) {
        ClientFeatureFlagsDeliverySeed everyMachine = ClientFeatureFlagsDeliverySeed.forEveryMachine(flags);
        boolean carried = deliveryRouter.dispatch(everyMachine);
        if (carried) {
            log.info("Client feature flags sent to every machine: {}", flags);
        }
    }
}
