package com.openframe.delivery.dispatch;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.installedagents.InstalledAgent;
import com.openframe.data.repository.installedagents.InstalledAgentRepository;
import com.openframe.delivery.config.DeliveryProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Optional;

@Component
@RequiredArgsConstructor
public class DeliveryGate {

    private static final String OPENFRAME_CLIENT_AGENT_TYPE = "openframe-client";

    private final DeliveryProperties properties;
    private final InstalledAgentRepository installedAgentRepository;

    public boolean isOpen(DeliveryType type, String machineId) {
        if (!properties.isEnabled(type)) {
            return false;
        }
        Optional<String> minAgentVersion = properties.minAgentVersion(type);
        return minAgentVersion
                .map(minimum -> isAgentAtLeast(machineId, minimum))
                .orElse(false);
    }

    private boolean isAgentAtLeast(String machineId, String minimum) {
        return installedAgentRepository.findByMachineIdAndAgentType(machineId, OPENFRAME_CLIENT_AGENT_TYPE)
                .map(InstalledAgent::getVersion)
                .filter(StringUtils::hasText)
                .map(version -> AgentVersion.isAtLeast(version, minimum))
                .orElse(false);
    }
}
