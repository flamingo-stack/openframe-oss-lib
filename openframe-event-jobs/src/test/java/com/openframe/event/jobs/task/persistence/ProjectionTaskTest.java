package com.openframe.event.jobs.task.persistence;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class ProjectionTaskTest {

    private static final Instant OPENED_AT = Instant.parse("2026-10-22T10:00:00Z");
    private static final Instant LATER = Instant.parse("2026-10-22T10:05:00Z");

    @Test
    void anOpenedTask_isRunningFromTheFirstItem_underTheIdOfItsProjectionTenantAndSource() {
        // execution
        ProjectionTask task = open();

        // verifications
        assertThat(task.getId()).isEqualTo("organization-on-tickets:tenant-a:org-doc-1");
        assertThat(task.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(task.getLastId()).isNull();
        assertThat(task.getEventVersion()).isEqualTo(4L);
        assertThat(task.getCreatedAt()).isEqualTo(OPENED_AT);
        assertThat(task.getStartedAt()).isEqualTo(OPENED_AT);
        assertThat(task.getRunId()).isEqualTo("event version 4");
    }

    @Test
    void aNewerEvent_startsTheTaskAgainFromTheFirstItem_andKeepsWhenItWasCreated() {
        // setup
        ProjectionTask failedHalfway = open().recordBatch("t500", OPENED_AT).recordFailure("boom", OPENED_AT)
                .finish(EventJobStatus.FAILED, OPENED_AT);
        Map<String, Object> newerEnvelope = Map.of("version", 5);

        // execution
        ProjectionTask restarted = failedHalfway.restartWith(newerEnvelope, 5, LATER);

        // verifications
        assertThat(restarted.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(restarted.getEnvelope()).isEqualTo(newerEnvelope);
        assertThat(restarted.getEventVersion()).isEqualTo(5L);
        assertThat(restarted.getLastId()).isNull();
        assertThat(restarted.getBatches()).isZero();
        assertThat(restarted.getFailures()).isZero();
        assertThat(restarted.getLastError()).isNull();
        assertThat(restarted.getStartedAt()).isEqualTo(LATER);
        assertThat(restarted.getCreatedAt()).isEqualTo(OPENED_AT);
    }

    @Test
    void aSavedBatch_movesTheLastId_andResetsTheFailures() {
        // setup
        ProjectionTask failedOnce = open().recordFailure("boom", OPENED_AT);

        // execution
        ProjectionTask progressed = failedOnce.recordBatch("t500", LATER);

        // verifications
        assertThat(progressed.getLastId()).isEqualTo("t500");
        assertThat(progressed.getBatches()).isEqualTo(1);
        assertThat(progressed.getFailures()).isZero();
        assertThat(progressed.getUpdatedAt()).isEqualTo(LATER);
    }

    private static ProjectionTask open() {
        Map<String, Object> envelope = Map.of("version", 4);
        return ProjectionTask.open("organization-on-tickets", "organizations", "tenant-a", "org-doc-1", envelope, 4, OPENED_AT);
    }
}
