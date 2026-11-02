package com.openframe.delivery.rollout;

import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.delivery.MachineDeliverySequenceRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.dispatch.DeliveryPayloadBody;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.track.DeliveryId;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Objects;

@Slf4j
@Component
@RequiredArgsConstructor
public class DeliveryRolloutRecorder {

    // the smallest ObjectId: machine ids are ObjectIds in Mongo and a string cursor never matches one ($gt only compares
    // values of the same type), the walk would find nothing; Spring Data turns this hex into an ObjectId in the query
    static final String BEFORE_FIRST_MACHINE = "000000000000000000000000";

    private final MachineDeliveryRolloutRepository repository;
    private final MachineDeliverySequenceRepository sequences;
    private final DeliveryPayloadJson payloadJson;
    private final TenantIdProvider tenants;
    private final DeliveryMetrics metrics;

    // the sequence is taken once, when the rollout starts: a dispatch recorded later outranks every row of this
    // rollout on the agent, however long the batches take. A start with the body of the rollout still running is the
    // same order handed over twice (a publisher that retried after a failure beside the engine): the walk goes on,
    // nothing restarts. A different body is a new order and takes the rollout over, as before
    public void record(DeliveryRequest<? extends DeliveryPayload> request) {
        DeliveryType type = request.getType();
        String targetId = request.getTargetId();
        String tenantId = tenants.getTenantId();
        String id = DeliveryId.rollout(tenantId, type, targetId);
        DeliveryPayload payload = request.getPayload();
        DeliveryPayloadBody body = payloadJson.body(payload);
        if (isRunningWithTheSameBody(id, body)) {
            log.info("Delivery rollout already running with this body, the start is a repeat: type={} targetId={}", type, targetId);
            return;
        }
        int sequence = sequences.next();
        String json = payloadJson.write(payload);
        MachineDeliveryRollout rollout = MachineDeliveryRollout.builder()
                .id(id)
                .type(type)
                .targetId(targetId)
                .payloadJson(json)
                .bodyHash(body.hash())
                .sequence(sequence)
                .status(DeliveryRolloutStatus.RUNNING)
                .cursor(BEFORE_FIRST_MACHINE)
                .dispatched(0)
                .startedAt(Instant.now())
                .build();
        repository.save(rollout);
        metrics.recordRolloutStarted(type);
        log.info("Delivery rollout started: type={} targetId={} sequence={}", type, targetId, sequence);
    }

    private boolean isRunningWithTheSameBody(String id, DeliveryPayloadBody body) {
        return repository.findById(id)
                .filter(rollout -> rollout.getStatus() == DeliveryRolloutStatus.RUNNING)
                .filter(rollout -> Objects.equals(rollout.getBodyHash(), body.hash()))
                .isPresent();
    }
}
