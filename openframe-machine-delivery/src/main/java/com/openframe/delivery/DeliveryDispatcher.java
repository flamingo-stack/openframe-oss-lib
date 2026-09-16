package com.openframe.delivery;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryDispatcher {

    private final DeliverySpecRegistry registry;
    private final DeliveryRecorder recorder;

    public void dispatch(DeliverySeed seed) {
        DeliverySpec<?, ?> spec = registry.require(seed.type());
        dispatch(spec, seed);
    }

    private <S extends DeliverySeed, P> void dispatch(DeliverySpec<S, P> spec, DeliverySeed seed) {
        Class<S> seedClass = spec.getSeedClass();
        S typedSeed = seedClass.cast(seed);
        DeliveryRequest<P> request = spec.request(typedSeed);
        recorder.record(request);
        spec.publish(request.getMachineId(), request.getPayload());
        log.info("Delivery dispatched: type={} targetId={} machineId={}",
                request.getType(), request.getTargetId(), request.getMachineId());
    }
}
