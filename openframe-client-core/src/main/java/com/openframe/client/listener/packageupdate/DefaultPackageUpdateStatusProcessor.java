package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.PackageUpdateSource;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.State;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Waiting;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.PackageUpdateDeviceStateRepository;
import com.openframe.data.repository.rmm.PackageUpdateRequestRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class DefaultPackageUpdateStatusProcessor implements PackageUpdateStatusProcessor {

    private final MachineRepository machineRepository;
    private final PackageUpdateDeviceStateRepository deviceStateRepository;
    private final PackageUpdateRequestRepository requestRepository;
    private final ObjectProvider<PackageUpdateNotifier> notifier;

    @Override
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

        if (isDuplicate(state, event) || isStale(state, event)) {
            log.debug("[package-update] skipping duplicate/stale event {} requestId={} machineId={}",
                    event.getEventId(), requestId, machineId);
            return;
        }

        PackageUpdateRequest request = requestRepository.findByTenantIdAndRequestId(tenantId, requestId).orElse(null);
        apply(state, event);
        armDeadline(state, request, event);
        deviceStateRepository.save(state);
        log.info("[package-update] status applied requestId={} machineId={} eventId={} state={} status={} "
                        + "waitingReason={} waitingPhase={} closesAt={} doneResult={} rebootRequired={} relaunched={} "
                        + "failedReason={} exitCode={} failedMessage={} deadlineAt={}",
                requestId, machineId, event.getEventId(), state.getState(), state.getStatus(),
                state.getWaitingReason(), state.getWaitingPhase(), state.getClosesAt(), state.getDoneResult(),
                state.getRebootRequired(), state.getRelaunched(), state.getFailedReason(), state.getExitCode(),
                state.getFailedMessage(), state.getDeadlineAt());

        notify(request, state, event);
        rollUp(tenantId, requestId, request);
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

    private void apply(PackageUpdateDeviceState state, PackageUpdateStatusMessage event) {
        state.setLastEventId(event.getEventId());
        if (event.getAt() != null) {
            state.setLastEventAt(event.getAt());
        }
        state.setState(name(event.getState()));
        state.setInstalledVersion(event.getInstalledVersion());
        state.setAvailableVersion(event.getAvailableVersion());

        clearDetail(state);
        switch (event.getState()) {
            case WAITING -> applyWaiting(state, event.getWaiting());
            case DONE -> applyDone(state, event.getDone());
            case FAILED -> applyFailed(state, event.getFailed());
        }
        state.setUpdatedAt(Instant.now());
    }

    private void applyWaiting(PackageUpdateDeviceState state, PackageUpdateStatusMessage.Waiting waiting) {
        state.setStatus(SoftwareActionStatus.WAITING);
        if (waiting == null) {
            return;
        }
        state.setWaitingReason(name(waiting.getReason()));
        state.setWaitingPhase(name(waiting.getPhase()));
        state.setClosesAt(waiting.getClosesAt());
        state.setHolders(waiting.getHolders() == null ? null : waiting.getHolders().stream()
                .map(h -> PackageUpdateDeviceState.Holder.builder().app(h.getApp()).user(h.getUser()).build())
                .toList());
    }

    private void applyDone(PackageUpdateDeviceState state, PackageUpdateStatusMessage.Done done) {
        state.setStatus(SoftwareActionStatus.COMPLETED);
        if (done == null) {
            return;
        }
        state.setDoneResult(name(done.getResult()));
        state.setRebootRequired(done.getRebootRequired());
        state.setRelaunched(done.getRelaunched());
    }

    private void applyFailed(PackageUpdateDeviceState state, PackageUpdateStatusMessage.Failed failed) {
        state.setStatus(SoftwareActionStatus.FAILED);
        if (failed == null) {
            return;
        }
        state.setFailedReason(name(failed.getReason()));
        state.setFailedMessage(failed.getMessage());
        state.setExitCode(failed.getExitCode());
    }

    private void clearDetail(PackageUpdateDeviceState state) {
        state.setWaitingReason(null);
        state.setWaitingPhase(null);
        state.setClosesAt(null);
        state.setHolders(null);
        state.setDoneResult(null);
        state.setRebootRequired(null);
        state.setRelaunched(null);
        state.setFailedReason(null);
        state.setFailedMessage(null);
        state.setExitCode(null);
    }

    private void armDeadline(PackageUpdateDeviceState state, PackageUpdateRequest request, PackageUpdateStatusMessage event) {
        if (request == null || request.getMode() != PackageUpdateMode.WAIT || request.getDeadlineSeconds() == null) {
            return;
        }
        if (state.getDeadlineAt() != null || event.getAt() == null) {
            return;
        }
        if (event.getState() == State.WAITING && event.getWaiting() != null
                && event.getWaiting().getReason() == Waiting.Reason.APP_RUNNING) {
            state.setDeadlineAt(event.getAt().plusSeconds(request.getDeadlineSeconds()));
        }
    }

    private void notify(PackageUpdateRequest request, PackageUpdateDeviceState state, PackageUpdateStatusMessage event) {
        PackageUpdateNotifier bound = notifier.getIfAvailable();
        if (bound == null || request == null) {
            return;
        }
        switch (event.getState()) {
            case WAITING -> {
                Waiting.Phase phase = event.getWaiting() == null ? null : event.getWaiting().getPhase();
                if (phase == Waiting.Phase.PROMPT) {
                    bound.prompt(request, state);
                } else if (phase == Waiting.Phase.COUNTDOWN) {
                    bound.countdown(request, state);
                }
            }
            case FAILED -> {
                if (event.getFailed() != null && event.getFailed().getReason() == Failed.Reason.SUPERSEDED) {
                    return;   // a newer request carries on; no card
                }
                if (request.getSource() == PackageUpdateSource.AUTO) {
                    bound.autoUpdateFailed(request, state);
                } else {
                    bound.updateFailed(request, state);
                }
            }
            case DONE -> { /* "Up to date" is driven by inventory, not a card */ }
        }
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
        boolean allTerminal = all.stream().allMatch(DefaultPackageUpdateStatusProcessor::isTerminal);
        if (allTerminal) {
            return all.stream().anyMatch(s -> s.getStatus() == SoftwareActionStatus.FAILED)
                    ? SoftwareActionStatus.FAILED : SoftwareActionStatus.COMPLETED;
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

    private static String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
