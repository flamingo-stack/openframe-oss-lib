package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Done;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.State;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PackageUpdateExecutionRecorderTest {

    @Mock private ScriptExecutionRepository scriptExecutionRepository;

    @InjectMocks private PackageUpdateExecutionRecorder recorder;

    private final PackageUpdateRequest request = PackageUpdateRequest.builder()
            .tenantId("t1").requestId("req-1").executionId("exec-1").build();

    private ScriptExecution rowFound(ExecutionStatus status) {
        ScriptExecution row = ScriptExecution.builder()
                .tenantId("t1").executionId("exec-1").machineId("m1").packageUpdateRequestId("req-1")
                .status(status).build();
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineIdAndPackageUpdateRequestId(
                "t1", "exec-1", "m1", "req-1")).thenReturn(Optional.of(row));
        return row;
    }

    private static PackageUpdateStatusMessage event(State state) {
        PackageUpdateStatusMessage e = new PackageUpdateStatusMessage();
        e.setRequestId("req-1");
        e.setState(state);
        return e;
    }

    private static PackageUpdateStatusMessage done(Done.Result result, String installedVersion, Boolean reboot) {
        PackageUpdateStatusMessage e = event(State.DONE);
        Done d = new Done();
        d.setResult(result);
        d.setRebootRequired(reboot);
        e.setDone(d);
        e.setInstalledVersion(installedVersion);
        return e;
    }

    private static PackageUpdateStatusMessage failed(Failed.Reason reason, String message, Long exitCode) {
        PackageUpdateStatusMessage e = event(State.FAILED);
        Failed f = new Failed();
        f.setReason(reason);
        f.setMessage(message);
        f.setExitCode(exitCode);
        e.setFailed(f);
        return e;
    }

    @Test
    void waiting_marksQueuedRowRunning() {
        ScriptExecution row = rowFound(ExecutionStatus.QUEUED);

        recorder.record(request, "m1", event(State.WAITING));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(row.getWaiting()).isTrue();
        assertThat(row.getStatusChangedAt()).isNotNull();
        verify(scriptExecutionRepository).save(row);
    }

    @Test
    void waiting_onARunningRowWithoutTheFlag_marksItWaiting() {
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);
        row.setStdout("kept");

        recorder.record(request, "m1", event(State.WAITING));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(row.getWaiting()).isTrue();
        assertThat(row.getStdout()).isEqualTo("kept");
        verify(scriptExecutionRepository).save(row);
    }

    @Test
    void waiting_afterAFailedAttempt_clearsTheOldOutcome() {
        ScriptExecution row = rowFound(ExecutionStatus.FAILED);
        row.setError("TIMEOUT");
        row.setExitCode(1);

        recorder.record(request, "m1", event(State.WAITING));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(row.getFinishedAt()).isNull();
        assertThat(row.getError()).isNull();
        assertThat(row.getExitCode()).isNull();
    }

    @Test
    void waiting_againWhileWaiting_writesNothing() {
        rowFound(ExecutionStatus.RUNNING).setWaiting(true);

        recorder.record(request, "m1", event(State.WAITING));

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    void done_upgraded_succeedsWithSummary() {
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);
        row.setWaiting(true);

        recorder.record(request, "m1", done(Done.Result.UPGRADED, "4.36.140", true));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.SUCCESS);
        assertThat(row.getWaiting()).isNull();
        assertThat(row.getFinishedAt()).isNotNull();
        assertThat(row.getStdout()).isEqualTo("Updated (4.36.140), reboot required.");
        assertThat(row.getError()).isNull();
        verify(scriptExecutionRepository).save(row);
    }

    @Test
    void done_alreadyLatest_succeeds() {
        ScriptExecution row = rowFound(ExecutionStatus.QUEUED);

        recorder.record(request, "m1", done(Done.Result.ALREADY_LATEST, "4.36.140", false));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.SUCCESS);
        assertThat(row.getStdout()).isEqualTo("Already up to date (4.36.140).");
    }

    @Test
    void failed_failsWithReasonMessageAndExitCode() {
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);
        row.setWaiting(true);

        recorder.record(request, "m1", failed(Failed.Reason.MANAGER_ERROR, "winget exited 1", 1L));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(row.getWaiting()).isNull();
        assertThat(row.getFinishedAt()).isNotNull();
        assertThat(row.getError()).isEqualTo("MANAGER_ERROR: winget exited 1");
        assertThat(row.getExitCode()).isEqualTo(1);
        assertThat(row.getStdout()).isNull();
    }

    @Test
    void notInstalled_keepsTheReasonOnTheRow() {
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);

        recorder.record(request, "m1", failed(Failed.Reason.NOT_INSTALLED, null, null));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(row.getError()).isEqualTo("NOT_INSTALLED");
    }

    @Test
    void superseded_closesTheRow() {
        // a newer request carries the update on under another execution — this one will not finish it
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);

        recorder.record(request, "m1", failed(Failed.Reason.SUPERSEDED, null, null));

        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(row.getError()).isEqualTo(PackageUpdateExecutionRecorder.SUPERSEDED_ERROR);
    }

    @Test
    void undelivered_failsTheRowWithTheDeliveryReason() {
        ScriptExecution row = rowFound(ExecutionStatus.RUNNING);

        recorder.recordUndelivered(request, "m1", DeliveryFailure.EXHAUSTED);

        verify(scriptExecutionRepository).save(row);
        assertThat(row.getStatus()).isEqualTo(ExecutionStatus.FAILED);
        assertThat(row.getError()).isEqualTo("The device did not receive the update (EXHAUSTED)");
        assertThat(row.getFinishedAt()).isNotNull();
        assertThat(row.getStatusChangedAt()).isNotNull();
        assertThat(row.getExitCode()).isNull();
    }

    @Test
    void undelivered_noRowOwnedByThisRequest_writesNothing() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineIdAndPackageUpdateRequestId(
                "t1", "exec-1", "m1", "req-1")).thenReturn(Optional.empty());

        recorder.recordUndelivered(request, "m1", DeliveryFailure.OFFLINE);
        recorder.recordUndelivered(null, "m1", DeliveryFailure.OFFLINE);

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    void noRowOwnedByThisRequest_writesNothing() {
        when(scriptExecutionRepository.findByTenantIdAndExecutionIdAndMachineIdAndPackageUpdateRequestId(
                "t1", "exec-1", "m1", "req-1")).thenReturn(Optional.empty());

        recorder.record(request, "m1", done(Done.Result.UPGRADED, null, null));

        verify(scriptExecutionRepository, never()).save(any());
    }

    @Test
    void requestWithoutExecution_isSkipped() {
        // requests dispatched before the request carried its execution id
        PackageUpdateRequest legacy = PackageUpdateRequest.builder().tenantId("t1").requestId("req-0").build();

        recorder.record(legacy, "m1", done(Done.Result.UPGRADED, null, null));
        recorder.record(null, "m1", done(Done.Result.UPGRADED, null, null));

        verifyNoInteractions(scriptExecutionRepository);
    }
}
