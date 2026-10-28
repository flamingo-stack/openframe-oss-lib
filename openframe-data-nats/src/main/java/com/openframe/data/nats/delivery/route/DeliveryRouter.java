package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.service.machine.AgentVersionService;
import com.openframe.delivery.spec.DeliveryAudience;
import com.openframe.delivery.spec.DeliverySeed;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

// the one place a command leaves for the agent: the route is picked by the version the machine's client runs.
// ObjectProvider: a service with no route on its classpath still boots, its commands then reach no one
@Slf4j
@Component
public class DeliveryRouter {

    private static final Comparator<DeliveryRoute> NEWEST_FIRST = Comparator.comparingInt(DeliveryRoute::getGeneration).reversed();

    private final Map<DeliveryType, List<DeliveryRoute>> routesByType = new EnumMap<>(DeliveryType.class);
    private final AgentVersionService agentVersions;

    public DeliveryRouter(ObjectProvider<DeliveryRoute> routes, AgentVersionService agentVersions) {
        this.agentVersions = agentVersions;
        routes.orderedStream().sorted(NEWEST_FIRST).forEach(this::register);
        log.info("Delivery routes by type: {}", routesByType.keySet());
    }

    // true when a route carried the command. False is a machine the type cannot reach, not a failure: an agent
    // below the engine's floor on a type that never had a legacy subject, or a type switched off everywhere
    public boolean dispatch(DeliverySeed seed) {
        if (seed.getAudience() == DeliveryAudience.EVERY_MACHINE) {
            return dispatchToEveryMachine(seed);
        }
        DeliveryType type = seed.getType();
        String machineId = seed.getMachineId();
        String agentVersion = agentVersions.find(machineId).orElse("");
        Optional<DeliveryRoute> route = routesOf(type).stream()
                .filter(candidate -> candidate.canReach(type, agentVersion))
                .findFirst();
        route.ifPresent(reaching -> reaching.send(seed));
        if (route.isEmpty()) {
            log.info("No delivery route reaches the machine: type={} machineId={} agentVersion={}", type, machineId, agentVersion);
        }
        return route.isPresent();
    }

    private boolean dispatchToEveryMachine(DeliverySeed seed) {
        DeliveryType type = seed.getType();
        List<DeliveryRoute> routes = routesOf(type).stream()
                .filter(candidate -> candidate.canReachEveryMachine(type))
                .toList();
        routes.forEach(route -> route.sendToEveryMachine(seed));
        if (routes.isEmpty()) {
            log.info("No delivery route carries the type to every machine: type={} targetId={}", type, seed.getTargetId());
        }
        return !routes.isEmpty();
    }

    private List<DeliveryRoute> routesOf(DeliveryType type) {
        return routesByType.getOrDefault(type, List.of());
    }

    private void register(DeliveryRoute route) {
        for (DeliveryType type : route.getTypes()) {
            routesByType.computeIfAbsent(type, ignored -> new ArrayList<>()).add(route);
        }
    }
}
