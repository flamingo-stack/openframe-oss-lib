package com.openframe.data.nats.delivery.route;

import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.delivery.spec.DeliverySeed;

import java.util.Set;

// one way to carry a command of the types it covers to the agent. A machine takes the route of the highest
// generation that reaches it; a change for every machine goes out over each route that can carry it, every
// route to the agents it serves. A new agent contract is a new route, nothing else moves
public interface DeliveryRoute {

    Set<DeliveryType> getTypes();

    int getGeneration();

    boolean canReach(DeliveryType type, String agentVersion);

    boolean canReachEveryMachine(DeliveryType type);

    void send(DeliverySeed seed);

    void sendToEveryMachine(DeliverySeed seed);
}
