package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.delivery.PackageUpdateDeliverySeed;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateWire;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import com.openframe.delivery.dispatch.DeliveryDispatcher;
import com.openframe.delivery.track.DeliveryTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/**
 * Orchestrates one package-update status event: load state, drop duplicates/stale events,
 * reduce the device state, record history, and roll the request status up.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateStatusProcessor {

    private final MachineRepository machineRepository;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final PackageUpdateRequestRepository requestRepository;
    private final PackageUpdateExecutionRecorder executionRecorder;
    private final DeliveryDispatcher deliveryDispatcher;
    private final DeliveryTracker deliveryTracker;

    public void process(String machineId, PackageUpdateStatusMessage event) {
        Machine machine = machineRepository.findByMachineId(machineId).orElse(null);
        if (machine == null) {
            log.warn("[package-update] status for unknown machine {} requestId={} — ignoring", machineId, event.getRequestId());
            return;
        }
        String tenantId = machine.getTenantId();
        String requestId = event.getRequestId();

        PackageUpdateDeviceState state = deviceStateRepository
                .findByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId)
                .orElseGet(() -> newState(tenantId, requestId, machineId));

        if (isDuplicate(state, event)) {
            log.debug("[package-update] duplicate event {} requestId={} machineId={} — re-checking the roll-up", event.getEventId(), requestId, machineId);
            rollUp(tenantId, requestId, requestRepository.findByTenantIdAndRequestId(tenantId, requestId).orElse(null));
            return;
        }
        if (isStale(state, event)) {
            log.debug("[package-update] skipping stale event {} requestId={} machineId={}",
                    event.getEventId(), requestId, machineId);
            return;
        }

        PackageUpdateRequest request = requestRepository.findByTenantIdAndRequestId(tenantId, requestId).orElse(null);
        Instant deadlineBefore = state.getDeadlineAt();
        PackageUpdateDeviceStateReducer.apply(state, request, event);
        driveDeadlineForce(state, request, deadlineBefore, machineId);
        executionRecorder.record(request, machineId, event);
        deviceStateRepository.save(state);
        log.info("[package-update] status applied requestId={} machineId={} eventId={} state={} status={} "
                        + "waitingReason={} waitingPhase={} closesAt={} doneResult={} rebootRequired={} relaunched={} "
                        + "failedReason={} exitCode={} failedMessage={} deadlineAt={}",
                requestId, machineId, event.getEventId(), state.getState(), state.getStatus(),
                state.getWaitingReason(), state.getWaitingPhase(), state.getClosesAt(), state.getDoneResult(),
                state.getRebootRequired(), state.getRelaunched(), state.getFailedReason(), state.getExitCode(),
                state.getFailedMessage(), state.getDeadlineAt());

        rollUp(tenantId, requestId, request);
    }

    public void failUndelivered(String machineId, String requestId, DeliveryFailure failure) {
        Machine machine = machineRepository.findByMachineId(machineId).orElse(null);
        if (machine == null) {
            log.warn("[package-update] undelivered order for unknown machine {} requestId={} — ignoring", machineId, requestId);
            return;
        }
        String tenantId = machine.getTenantId();
        PackageUpdateDeviceState state = deviceStateRepository
                .findByTenantIdAndRequestIdAndMachineId(tenantId, requestId, machineId)
                .orElseGet(() -> newState(tenantId, requestId, machineId));
        if (state.getLastEventId() != null) {
            log.info("[package-update] delivery {} for requestId={} machineId={}, but the device already reports on it — left as is",
                    failure, requestId, machineId);
            return;
        }

        PackageUpdateRequest request = requestRepository.findByTenantIdAndRequestId(tenantId, requestId).orElse(null);
        PackageUpdateDeviceStateReducer.applyUndelivered(state, failure);
        executionRecorder.recordUndelivered(request, machineId, failure);
        deviceStateRepository.save(state);
        log.warn("[package-update] order not delivered requestId={} machineId={} reason={}", requestId, machineId, failure);

        rollUp(tenantId, requestId, request);
    }

    private void driveDeadlineForce(PackageUpdateDeviceState state, PackageUpdateRequest request, Instant deadlineBefore, String machineId) {
        Instant deadlineAt = state.getDeadlineAt();
        if (deadlineAt == null) {
            return;
        }
        String requestId = state.getRequestId();
        if (deadlineBefore == null) {
            deliveryDispatcher.schedule(PackageUpdateWire.deadlineForce(machineId, request), deadlineAt);
            log.info("[package-update] deadline force scheduled requestId={} machineId={} deadlineAt={}",
                    requestId, machineId, deadlineAt);
            return;
        }
        if (isTerminal(state) && Instant.now().isBefore(deadlineAt)) {
            deliveryTracker.cancel(DeliveryType.PACKAGE_UPDATE, PackageUpdateDeliverySeed.deadlineTargetId(requestId),
                    machineId, "update finished before its deadline");
            log.info("[package-update] deadline force withdrawn requestId={} machineId={} status={}",
                    requestId, machineId, state.getStatus());
        }
    }

    private PackageUpdateDeviceState newState(String tenantId, String requestId, String machineId) {
        Instant now = Instant.now();
        return PackageUpdateDeviceState.builder()
                .tenantId(tenantId).requestId(requestId).machineId(machineId)
                .status(SoftwareActionStatus.SCHEDULED).createdAt(now).updatedAt(now)
                .build();
    }

    private boolean isDuplicate(PackageUpdateDeviceState state, PackageUpdateStatusMessage event) {
        return event.getEventId() != null && event.getEventId().equals(state.getLastEventId());
    }

    private boolean isStale(PackageUpdateDeviceState state, PackageUpdateStatusMessage event) {
        return state.getLastEventAt() != null && event.getAt() != null && event.getAt().isBefore(state.getLastEventAt());
    }

    private void rollUp(String tenantId, String requestId, PackageUpdateRequest request) {
        if (request == null) {
            return;
        }
        List<PackageUpdateDeviceState> all = deviceStateRepository.findByTenantIdAndRequestId(tenantId, requestId);
        SoftwareActionStatus rolled = rollUpStatus(all);
        if (rolled != null && rolled != request.getStatus()) {
            log.info("[package-update] request status requestId={} {} -> {}", requestId, request.getStatus(), rolled);
            request.setStatus(rolled);
            request.setUpdatedAt(Instant.now());
            requestRepository.save(request);
        }
    }

    private static SoftwareActionStatus rollUpStatus(List<PackageUpdateDeviceState> all) {
        if (all.isEmpty()) {
            return null;
        }
        boolean allTerminal = all.stream().allMatch(PackageUpdateStatusProcessor::isTerminal);
        if (allTerminal) {
            return all.stream().anyMatch(s -> s.getStatus() == SoftwareActionStatus.FAILED) ? SoftwareActionStatus.FAILED : SoftwareActionStatus.COMPLETED;
        }
        if (all.stream().anyMatch(s -> s.getStatus() == SoftwareActionStatus.WAITING)) {
            return SoftwareActionStatus.WAITING;
        }
        if (all.stream().anyMatch(s -> s.getStatus() == SoftwareActionStatus.IN_PROGRESS)) {
            return SoftwareActionStatus.IN_PROGRESS;
        }
        return SoftwareActionStatus.SCHEDULED;
    }

    private static boolean isTerminal(PackageUpdateDeviceState s) {
        return s.getStatus() == SoftwareActionStatus.COMPLETED || s.getStatus() == SoftwareActionStatus.FAILED;
    }
}
