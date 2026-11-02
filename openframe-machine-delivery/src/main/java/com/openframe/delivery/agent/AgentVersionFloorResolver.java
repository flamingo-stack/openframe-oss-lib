package com.openframe.delivery.agent;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.config.DeliveryProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

// the floor of a type is its policy's min-agent-version (openframe.delivery.types.<TYPE>.min-agent-version): the
// server's routing rule, nothing the agent is told
@Component
@RequiredArgsConstructor
public class AgentVersionFloorResolver {

    private final DeliveryProperties properties;

    public AgentVersionFloor of(DeliveryType type) {
        DeliveryProperties.Policy policy = properties.resolve(type);
        return AgentVersionFloor.from(policy.getMinAgentVersion());
    }
}
