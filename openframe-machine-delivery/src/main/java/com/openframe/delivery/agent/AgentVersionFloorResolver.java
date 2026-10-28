package com.openframe.delivery.agent;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;
import com.openframe.data.document.clientconfiguration.OpenFrameClientConfiguration;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.service.OpenFrameClientConfigurationService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.Locale;

// the floor of a type is the tenant's client flag delivery-<type>, the one the agent reads to pick its own side
// of the subject: no flag, every agent; the flag off, no agent; the flag on, its min-version and up
@Component
@RequiredArgsConstructor
public class AgentVersionFloorResolver {

    static final String FLAG_PREFIX = "delivery-";

    private final OpenFrameClientConfigurationService clientConfigurationService;

    public AgentVersionFloor of(DeliveryType type) {
        String flagName = flagName(type);
        return clientConfigurationService.find()
                .map(OpenFrameClientConfiguration::getFeatureFlags)
                .map(flags -> flags.get(flagName))
                .map(AgentVersionFloorResolver::fromFlag)
                .orElse(AgentVersionFloor.EVERY_VERSION);
    }

    public static String flagName(DeliveryType type) {
        String name = type.name().toLowerCase(Locale.ROOT);
        return FLAG_PREFIX + name.replace('_', '-');
    }

    private static AgentVersionFloor fromFlag(ClientFeatureFlag flag) {
        if (!flag.isEnabled()) {
            return AgentVersionFloor.CLOSED;
        }
        return AgentVersionFloor.from(flag.getMinVersion());
    }
}
