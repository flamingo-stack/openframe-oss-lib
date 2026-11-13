package com.openframe.client.listener.packageupdate;

import com.openframe.data.document.delivery.DeliveryFailure;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.PackageUpdateRequest;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Done;
import com.openframe.data.nats.packageupdate.PackageUpdateStatusMessage.Failed;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Optional;

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateExecutionRecorder {

    static final String SUPERSEDED_ERROR = "Superseded by a newer update request";
    static final String FAILED_ERROR = "Update failed";
    static final String UNDELIVERED_ERROR = "The device did not receive the update";

    private final ScriptExecutionRepository scriptExecutionRepository;

    public void record(PackageUpdateRequest request, String machineId, PackageUpdateStatusMessage event) {
        ScriptExecution row = historyRow(request, machineId).orElse(null);
        if (row == null) {
            return;
        }
        Instant now = Instant.now();
        switch (event.getState()) {
            case WAITING -> {
                if (row.getStatus() == ExecutionStatus.RUNNING && Boolean.TRUE.equals(row.getWaiting())) {
                    return;
                }
                if (row.getStatus() != ExecutionStatus.RUNNING) {
                    update(row, ExecutionStatus.RUNNING, null, null, null, null);
                }
                row.setWaiting(true);
            }
            case DONE -> {
                update(row, ExecutionStatus.SUCCESS, now, null, summary(event), null);
                keepManagerOutput(row, event);
            }
            case FAILED -> {
                Failed failed = event.getFailed();
                update(row, ExecutionStatus.FAILED, now, exitCode(failed), null, error(failed));
                keepManagerOutput(row, event);
            }
        }
        row.setStatusChangedAt(now);
        scriptExecutionRepository.save(row);
    }

    public void recordUndelivered(PackageUpdateRequest request, String machineId, DeliveryFailure failure) {
        ScriptExecution row = historyRow(request, machineId).orElse(null);
        if (row == null) {
            return;
        }
        Instant now = Instant.now();
        update(row, ExecutionStatus.FAILED, now, null, null, UNDELIVERED_ERROR + " (" + failure + ")");
        row.setStatusChangedAt(now);
        scriptExecutionRepository.save(row);
    }

    private Optional<ScriptExecution> historyRow(PackageUpdateRequest request, String machineId) {
        if (request == null || request.getExecutionId() == null) {
            return Optional.empty();
        }
        Optional<ScriptExecution> row = scriptExecutionRepository
                .findByTenantIdAndExecutionIdAndMachineIdAndPackageUpdateRequestId(
                        request.getTenantId(), request.getExecutionId(), machineId, request.getRequestId());
        if (row.isEmpty()) {
            log.warn("[package-update] no history row for requestId={} executionId={} machineId={}",
                    request.getRequestId(), request.getExecutionId(), machineId);
        }
        return row;
    }

    private static void update(ScriptExecution row, ExecutionStatus status, Instant finishedAt, Integer exitCode,
                               String stdout, String error) {
        row.setStatus(status);
        row.setWaiting(null);
        row.setFinishedAt(finishedAt);
        row.setExitCode(exitCode);
        row.setStdout(stdout);
        row.setStdoutTruncated(null);
        row.setStderr(null);
        row.setStderrTruncated(null);
        row.setError(error);
    }

    // the package manager's own output of the run; the summary line stays first
    private static void keepManagerOutput(ScriptExecution row, PackageUpdateStatusMessage event) {
        String stdout = event.getStdout();
        if (hasText(stdout)) {
            String summary = row.getStdout();
            String shown = hasText(summary) ? summary + "\n\n" + stdout : stdout;
            row.setStdout(capped(shown));
            row.setStdoutTruncated(shown.length() > ScriptExecution.MAX_OUTPUT_BYTES);
        }
        String stderr = event.getStderr();
        if (hasText(stderr)) {
            row.setStderr(capped(stderr));
            row.setStderrTruncated(stderr.length() > ScriptExecution.MAX_OUTPUT_BYTES);
        }
    }

    private static String capped(String output) {
        return output.length() > ScriptExecution.MAX_OUTPUT_BYTES
                ? output.substring(0, ScriptExecution.MAX_OUTPUT_BYTES)
                : output;
    }

    private static String summary(PackageUpdateStatusMessage event) {
        Done done = event.getDone();
        boolean latest = done != null && done.getResult() == Done.Result.ALREADY_LATEST;
        String summary = latest ? "Already up to date" : "Updated";
        if (hasText(event.getInstalledVersion())) {
            summary += " (" + event.getInstalledVersion() + ")";
        }
        if (done != null && Boolean.TRUE.equals(done.getRebootRequired())) {
            summary += ", reboot required";
        }
        return summary + ".";
    }

    private static String error(Failed failed) {
        if (failed == null) {
            return FAILED_ERROR;
        }
        if (failed.getReason() == Failed.Reason.SUPERSEDED) {
            return SUPERSEDED_ERROR;
        }
        String reason = failed.getReason() == null ? FAILED_ERROR : failed.getReason().name();
        return hasText(failed.getMessage()) ? reason + ": " + failed.getMessage() : reason;
    }

    private static Integer exitCode(Failed failed) {
        return failed == null || failed.getExitCode() == null ? null : failed.getExitCode().intValue();
    }
}
