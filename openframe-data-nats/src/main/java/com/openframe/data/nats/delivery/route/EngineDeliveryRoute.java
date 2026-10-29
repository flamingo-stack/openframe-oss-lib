package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.agent.AgentVersionFloor;
import com.openframe.delivery.agent.AgentVersionFloorResolver;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Set;

// the delivery engine: every type with a spec, for the environments that switched the type on and the agents the
// tenant's floor admits
@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class EngineDeliveryRoute implements DeliveryRoute {

    static final int GENERATION = 1;

    private final DeliverySpecRegistry specs;
    private final DeliveryProperties properties;
    private final AgentVersionFloorResolver floors;
    private final DeliveryDispatcher dispatcher;

    @Override
    public Set<DeliveryType> getTypes() {
        return specs.types();
    }

    @Override
    public int getGeneration() {
        return GENERATION;
    }

    @Override
    public boolean canReach(DeliveryType type, String agentVersion) {
        if (!properties.isEnabled(type)) {
            return false;
        }
        AgentVersionFloor floor = floors.of(type);
        return floor.admits(agentVersion);
    }

    @Override
    public boolean canReachEveryMachine(DeliveryType type) {
        if (!properties.isEnabled(type) || !isRolledOut(type)) {
            return false;
        }
        AgentVersionFloor floor = floors.of(type);
        return floor.open();
    }

    @Override
    public void send(DeliverySeed seed) {
        dispatcher.dispatch(seed);
    }

    @Override
    public void sendToEveryMachine(DeliverySeed seed) {
        dispatcher.dispatch(seed);
    }

    private boolean isRolledOut(DeliveryType type) {
        DeliverySpec<DeliverySeed, ?> spec = specs.require(type);
        return spec.canDeliverToEveryMachine();
    }
}
