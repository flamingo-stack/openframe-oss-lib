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
    void anOpenedTask_isTheCurrentRunFromTheFirstItem_underTheKeyOfItsProjectionTenantAndSource() {
        // execution
        ProjectionTask task = open();

        // verifications
        assertThat(task.getKey()).isEqualTo("organization-on-tickets:tenant-a:org-doc-1");
        assertThat(task.getId()).isEqualTo("organization-on-tickets:tenant-a:org-doc-1:4:" + OPENED_AT.toEpochMilli());
        assertThat(task.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(task.isCurrent()).isTrue();
        assertThat(task.getLastId()).isNull();
        assertThat(task.getEventVersion()).isEqualTo(4L);
        assertThat(task.getStartedAt()).isEqualTo(OPENED_AT);
        assertThat(task.getRunId()).isEqualTo("event version 4");
    }

    @Test
    void closingARunningRun_endsItReplaced() {
        // setup
        ProjectionTask halfway = open().recordBatch("t500", OPENED_AT);

        // execution
        ProjectionTask closed = halfway.close(LATER);

        // verifications
        assertThat(closed.getStatus()).isEqualTo(EventJobStatus.REPLACED);
        assertThat(closed.isCurrent()).isFalse();
        assertThat(closed.getLastId()).isEqualTo("t500");
        assertThat(closed.getUpdatedAt()).isEqualTo(LATER);
    }

    @Test
    void closingAFailedRun_keepsItFailed() {
        // setup
        ProjectionTask failed = open().recordFailure("boom", OPENED_AT).finish(EventJobStatus.FAILED, OPENED_AT);

        // execution
        ProjectionTask closed = failed.close(LATER);

        // verifications
        assertThat(failed.isCurrent()).isTrue();
        assertThat(closed.getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(closed.getLastError()).isEqualTo("boom");
        assertThat(closed.isCurrent()).isFalse();
    }

    @Test
    void aDoneRun_isNotCurrent() {
        // execution
        ProjectionTask done = open().finish(EventJobStatus.DONE, LATER);

        // verifications
        assertThat(done.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(done.isCurrent()).isFalse();
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
