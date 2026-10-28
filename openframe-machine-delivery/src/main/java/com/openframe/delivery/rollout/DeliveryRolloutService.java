package com.openframe.delivery.rollout;

import com.openframe.data.document.delivery.DeliveryRolloutStatus;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.delivery.MachineDeliveryRollout;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.delivery.MachineDeliveryRolloutRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.service.machine.AgentVersionService;
import com.openframe.delivery.agent.AgentVersionFloor;
import com.openframe.delivery.agent.AgentVersionFloorResolver;
import com.openframe.delivery.config.DeliveryProperties;
import com.openframe.delivery.dispatch.DeliveryPayloadJson;
import com.openframe.delivery.dispatch.DeliverySink;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.delivery.spec.DeliveryPayload;
import com.openframe.delivery.spec.DeliveryRef;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.delivery.spec.DeliverySeed;
import com.openframe.delivery.spec.DeliverySpec;
import com.openframe.delivery.spec.DeliverySpecRegistry;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static java.util.stream.Collectors.counting;
import static java.util.stream.Collectors.groupingBy;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.delivery.sweep.enabled", havingValue = "true")
public class DeliveryRolloutService {

    private final MachineDeliveryRolloutRepository repository;
    private final MachineRepository machineRepository;
    private final AgentVersionService agentVersions;
    private final AgentVersionFloorResolver floors;
    private final DeliverySpecRegistry registry;
    private final DeliveryProperties properties;
    private final DeliveryPayloadJson payloadJson;
    private final DeliverySink sink;
    private final DeliveryMetrics metrics;

    public void advance() {
        List<MachineDeliveryRollout> running = repository.findByStatus(DeliveryRolloutStatus.RUNNING);
        countRunning(running);
        running.forEach(this::advanceOne);
    }

    private void countRunning(List<MachineDeliveryRollout> running) {
        Map<DeliveryType, Long> byType = running.stream().collect(groupingBy(MachineDeliveryRollout::getType, counting()));
        for (DeliveryType type : DeliveryType.values()) {
            int count = byType.getOrDefault(type, 0L).intValue();
            metrics.recordRolloutsRunning(type, count);
        }
    }

    // a batch that fails midway is repeated next tick from the same cursor: the machines already handed out have a
    // row with this very sequence, so the repeat skips them as outranked and nothing reaches the agent twice
    private void advanceOne(MachineDeliveryRollout rollout) {
        try {
            dispatchNextBatch(rollout);
        } catch (Exception e) {
            metrics.recordRolloutBatchFailed(rollout.getType());
            log.error("Delivery rollout batch failed, repeated next tick: id={}", rollout.getId(), e);
        }
    }

    private void dispatchNextBatch(MachineDeliveryRollout rollout) {
        DeliveryType type = rollout.getType();
        DeliverySpec<DeliverySeed, DeliveryPayload> spec = registry.require(type);
        Set<DeviceStatus> statuses = spec.getDeliverableStatuses();
        int batchSize = properties.getSweep().getBatchSize();
        String cursor = rollout.getCursor();
        List<Machine> machines = machineRepository.findByStatusInAndIdGreaterThanOrderByIdAsc(statuses, cursor, Limit.of(batchSize));
        List<Machine> admitted = admittedByTheFloor(machines, type);
        admitted.forEach(machine -> dispatchTo(machine, rollout, spec));
        String id = rollout.getId();
        int sequence = rollout.getSequence();
        int dispatched = admitted.size();
        metrics.recordRolloutMachines(type, dispatched);
        if (isLastBatch(machines, batchSize)) {
            repository.finish(id, sequence, dispatched);
            Duration took = Duration.between(rollout.getStartedAt(), Instant.now());
            metrics.recordRolloutFinished(type, took);
            log.info("Delivery rollout finished: id={} sequence={} took={}", id, sequence, took);
            return;
        }
        Machine last = machines.get(machines.size() - 1);
        repository.advance(id, sequence, last.getId(), dispatched);
    }

    // a machine below the floor is walked past, not held: its row would wait out the window for an agent that never
    // listens on the engine's subject, and the legacy broadcast of the same change already reached it
    private List<Machine> admittedByTheFloor(List<Machine> machines, DeliveryType type) {
        AgentVersionFloor floor = floors.of(type);
        if (floor.isForEveryVersion()) {
            return machines;
        }
        List<String> machineIds = machines.stream().map(Machine::getMachineId).toList();
        Map<String, String> versions = agentVersions.findAll(machineIds);
        List<Machine> admitted = machines.stream()
                .filter(machine -> floor.admits(versions.get(machine.getMachineId())))
                .toList();
        int left = machines.size() - admitted.size();
        if (left > 0) {
            metrics.recordRolloutBelowFloor(type, left);
            log.info("Delivery rollout walked past {} machine(s) below the floor: type={} floor={}", left, type, floor);
        }
        return admitted;
    }

    // Mongo being away stops the batch, and the tick after retries it; any other failure is this one machine's and
    // must not hold the rest of the tenant: the machine is skipped and counted, it catches up at registration or on
    // the next rollout
    private void dispatchTo(Machine machine, MachineDeliveryRollout rollout, DeliverySpec<DeliverySeed, DeliveryPayload> spec) {
        try {
            dispatchToMachine(machine, rollout, spec);
        } catch (DataAccessResourceFailureException | TransientDataAccessException mongoAway) {
            throw mongoAway;
        } catch (RuntimeException thisMachineOnly) {
            metrics.recordRolloutMachineSkipped(rollout.getType());
            log.error("Delivery rollout skipped a machine: id={} machineId={}", rollout.getId(), machine.getMachineId(), thisMachineOnly);
        }
    }

    private void dispatchToMachine(Machine machine, MachineDeliveryRollout rollout, DeliverySpec<DeliverySeed, DeliveryPayload> spec) {
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
