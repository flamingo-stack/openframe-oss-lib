package com.openframe.delivery.rollout;

import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryRolloutRecorder {

    static final String BEFORE_FIRST_MACHINE = "";

    private final MachineDeliveryRolloutRepository repository;
    private final MachineDeliverySequenceRepository sequences;
    private final DeliveryPayloadJson payloadJson;

    // the sequence is taken once, when the rollout starts: a dispatch recorded later outranks every row of this
    // rollout on the agent, however long the batches take
    public void record(DeliveryRequest<?> request) {
        DeliveryType type = request.getType();
        String targetId = request.getTargetId();
        String id = DeliveryId.of(type, targetId);
        int sequence = sequences.next();
        DeliveryPayload payload = request.getPayload();
        String json = payloadJson.write(payload);
        MachineDeliveryRollout rollout = MachineDeliveryRollout.builder()
                .id(id)
                .type(type)
                .targetId(targetId)
                .payloadJson(json)
                .sequence(sequence)
                .status(DeliveryRolloutStatus.RUNNING)
                .cursor(BEFORE_FIRST_MACHINE)
                .dispatched(0)
                .startedAt(Instant.now())
                .build();
        repository.save(rollout);
        log.info("Delivery rollout started: type={} targetId={} sequence={}", type, targetId, sequence);
    }
}
