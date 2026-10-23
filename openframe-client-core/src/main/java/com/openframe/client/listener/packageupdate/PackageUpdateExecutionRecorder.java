package com.openframe.client.listener.packageupdate;

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

import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = {"openframe.rmm.software.enabled", "openframe.rmm.software.package-update.enabled"}, havingValue = "true")
@RequiredArgsConstructor
public class PackageUpdateExecutionRecorder {

    static final String SUPERSEDED_ERROR = "Superseded by a newer update request";
    static final String FAILED_ERROR = "Update failed";

    private final ScriptExecutionRepository scriptExecutionRepository;

    public void record(PackageUpdateRequest request, String machineId, PackageUpdateStatusMessage event) {
        if (request == null || request.getExecutionId() == null) {
            return;
        }
        ScriptExecution row = scriptExecutionRepository
                .findByTenantIdAndExecutionIdAndMachineIdAndPackageUpdateRequestId(
                        request.getTenantId(), request.getExecutionId(), machineId, request.getRequestId())
                .orElse(null);
        if (row == null) {
            log.warn("[package-update] no history row for requestId={} executionId={} machineId={}",
                    request.getRequestId(), request.getExecutionId(), machineId);
            return;
        }
        Instant now = Instant.now();
        switch (event.getState()) {
            case WAITING -> {
                if (row.getStatus() == ExecutionStatus.RUNNING) {
                    return;
                }
                // a retried request waits again: the previous attempt's outcome no longer applies
                update(row, ExecutionStatus.RUNNING, null, null, null, null);
            }
            case DONE -> update(row, ExecutionStatus.SUCCESS, now, null, summary(event), null);
            case FAILED -> {
                Failed failed = event.getFailed();
                update(row, ExecutionStatus.FAILED, now, exitCode(failed), null, error(failed));
            }
        }
        row.setStatusChangedAt(now);
        scriptExecutionRepository.save(row);
    }

    private static void update(ScriptExecution row, ExecutionStatus status, Instant finishedAt, Integer exitCode,
                               String stdout, String error) {
        row.setStatus(status);
        row.setFinishedAt(finishedAt);
        row.setExitCode(exitCode);
        row.setStdout(stdout);
        row.setError(error);
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
