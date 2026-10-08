package com.openframe.delivery.rollout;

import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class DeliveryRolloutService {

    private final MachineDeliveryRolloutRepository repository;
    private final MachineRepository machineRepository;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryPayloadJson payloadJson;
    private final DeliverySink sink;

    public void advance() {
        List<MachineDeliveryRollout> running = repository.findByStatus(DeliveryRolloutStatus.RUNNING);
        running.forEach(this::advanceOne);
    }

    // a batch that fails midway is repeated next tick from the same cursor: the machines already handed out get a
    // second row with the same sequence, which the agent treats as the same decision
    private void advanceOne(MachineDeliveryRollout rollout) {
        try {
            dispatchNextBatch(rollout);
        } catch (Exception e) {
            log.error("Delivery rollout batch failed, repeated next tick: id={}", rollout.getId(), e);
        }
    }

    private void dispatchNextBatch(MachineDeliveryRollout rollout) {
        DeliveryType type = rollout.getType();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();
        int batchSize = properties.getSweep().getBatchSize();
        String cursor = rollout.getCursor();
        List<Machine> machines = machineRepository.findByStatusInAndMachineIdGreaterThanOrderByMachineIdAsc(statuses, cursor, Limit.of(batchSize));
        machines.forEach(machine -> dispatchTo(machine, rollout, spec));
        String id = rollout.getId();
        int sequence = rollout.getSequence();
        int dispatched = machines.size();
        if (isLastBatch(machines, batchSize)) {
            repository.finish(id, sequence, dispatched);
            log.info("Delivery rollout finished: id={} sequence={}", id, sequence);
            return;
        }
        Machine last = machines.get(dispatched - 1);
        repository.advance(id, sequence, last.getMachineId(), dispatched);
    }

    private void dispatchTo(Machine machine, MachineDeliveryRollout rollout, DeliverySpec<DeliverySeed, DeliveryPayload> spec) {
        DeliveryType type = rollout.getType();
        String targetId = rollout.getTargetId();
        Class<DeliveryPayload> payloadClass = spec.getPayloadClass();
        DeliveryPayload payload = payloadJson.read(rollout.getPayloadJson(), payloadClass);
        String dispatchId = UUID.randomUUID().toString();
        DeliveryRef delivery = new DeliveryRef(type, targetId, dispatchId);
        delivery.setSequence(rollout.getSequence());
        payload.setDelivery(delivery);
        DeliveryRequest<DeliveryPayload> request = DeliveryRequest.<DeliveryPayload>builder()
                .type(type)
                .targetId(targetId)
                .machineId(machine.getMachineId())
                .payload(payload)
                .build();
        sink.accept(request);
    }

    private static boolean isLastBatch(List<Machine> machines, int batchSize) {
        return machines.size() < batchSize;
    }
}
