package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.rmm.software.PackageUpdateDeviceState;
import com.openframe.data.document.rmm.software.PackageUpdateMode;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Done;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.State;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Waiting;
import lombok.experimental.UtilityClass;

import java.time.Instant;

/**
 * Reduces a device's package-update state from an incoming status event.
 * Pure state derivation: no persistence, no side effects.
 */
@UtilityClass
public class PackageUpdateDeviceStateReducer {

    public void apply(PackageUpdateDeviceState state, PackageUpdateRequest request, PackageUpdateStatusMessage event) {
        applyEvent(state, event);
        armDeadline(state, request, event);
    }

    private void applyEvent(PackageUpdateDeviceState state, PackageUpdateStatusMessage event) {
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

    private void applyWaiting(PackageUpdateDeviceState state, Waiting waiting) {
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

    private void applyDone(PackageUpdateDeviceState state, Done done) {
        state.setStatus(SoftwareActionStatus.COMPLETED);
        if (done == null) {
            return;
        }
        state.setDoneResult(name(done.getResult()));
        state.setRebootRequired(done.getRebootRequired());
        state.setRelaunched(done.getRelaunched());
    }

    private void applyFailed(PackageUpdateDeviceState state, Failed failed) {
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

    private String name(Enum<?> value) {
        return value == null ? null : value.name();
    }
}
