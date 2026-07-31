package com.openframe.client.service.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.repository.rmm.CustomScriptExecutionRepository.LeafStatusCounts;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class ScheduleExecutionHeaderWatchdogService {

    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;

    /**
     * How long a header may sit in RUNNING before the sweep considers it stuck. Should exceed the
     * leaf watchdog's threshold so leaves are reaped first; the finalize is guarded regardless (a
     * header with any still-RUNNING leaf is skipped), so this only bounds how eagerly the sweep looks.
     */
    @Value("${openframe.rmm.schedule.watchdog.threshold-seconds:900}")
    private long thresholdSeconds;

    public boolean finalizeIfSettled(String tenantId, String executionId) {
        if (tenantId == null || executionId == null) {
            return false;
        }
        LeafStatusCounts counts = scriptExecutionRepository.countLeavesByStatus(tenantId, executionId);
        if (counts.running() > 0) {
            return false;   // still in flight → header stays RUNNING
        }
        ExecutionStatus finalStatus;
        if (counts.failed() > 0) {
            finalStatus = ExecutionStatus.FAILED;
        } else {
            // No running, no failed: all leaves succeeded, OR there are no leaves at all. A header
            // with zero leaves never actually ran → FAILED, not a misleading SUCCESS.
            boolean hasAnyLeaf = scriptExecutionRepository
                    .findFirstByTenantIdAndExecutionId(tenantId, executionId).isPresent();
            finalStatus = hasAnyLeaf ? ExecutionStatus.SUCCESS : ExecutionStatus.FAILED;
        }
        long modified = scheduleScriptExecutionRepository.transitionIfRunning(
                tenantId, executionId, finalStatus, Instant.now());
        if (modified > 0) {
            log.info("Finalized schedule fire header: executionId={} status=RUNNING→{} tenantId={}",
                    executionId, finalStatus, tenantId);
        }
        return modified > 0;
    }

    /** Sweep: finalize any RUNNING header older than the threshold whose leaves have all settled. */
    public void markStuckSheduleJobsAsFailed() {
        Instant now = Instant.now();
        List<ScheduleScriptExecution> candidates = scheduleScriptExecutionRepository
                .findByStatusAndDispatchedAtBefore(ExecutionStatus.RUNNING, now.minusSeconds(thresholdSeconds));
        if (candidates.isEmpty()) {
            log.debug("No stuck schedule-fire headers found");
            return;
        }
        int finalized = 0;
        for (ScheduleScriptExecution header : candidates) {
            if (finalizeIfSettled(header.getTenantId(), header.getExecutionId())) {
                finalized++;
            }
        }
        log.info("Schedule header watchdog: {} RUNNING header(s) past threshold, {} finalized",
                candidates.size(), finalized);
    }
}
