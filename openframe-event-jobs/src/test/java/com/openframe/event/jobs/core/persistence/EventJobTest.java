package com.openframe.event.jobs.core.persistence;

import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class EventJobTest {

    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");
    private static final Instant LATER = NOW.plusSeconds(60);

    @Test
    void aChange_returnsACopy_andLeavesTheJobAsItWas() {
        // setup
        EventJob job = EventJob.neverRun("backfill:organizations").startRun("run-1", NOW);

        // execution
        EventJob progressed = job.recordBatch("id-500", 500, 0, LATER);

        // verifications
        assertThat(progressed.getLastId()).isEqualTo("id-500");
        assertThat(job.getLastId()).isNull();
        assertThat(job.getProcessed()).isZero();
    }

    @Test
    void aJobThatNeverRan_isNoRunOfAnyRunId() {
        // setup
        EventJob job = EventJob.neverRun("backfill:organizations");

        // execution
        boolean runOf = job.hasRunId("run-1");

        // verifications
        assertThat(runOf).isFalse();
    }

    @Test
    void startRun_resetsTheProgress_butKeepsTheLastResult() {
        // setup
        EventJob job = EventJob.neverRun("reconciliation:tickets");
        job = job.startRun("run-1", NOW);
        job = job.recordBatch("id-500", 500, 3, NOW);
        job = job.recordFailure("boom", NOW);
        job = job.finishRun(EventJobStatus.DONE, NOW);

        // execution
        job = job.startRun("run-2", LATER);

        // verifications
        assertThat(job.hasRunId("run-2")).isTrue();
        assertThat(job.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(job.getLastId()).isNull();
        assertThat(job.getProcessed()).isZero();
        assertThat(job.getMismatches()).isZero();
        assertThat(job.getFailures()).isZero();
        assertThat(job.getLastError()).isNull();
        assertThat(job.getFinishedAt()).isNull();
        assertThat(job.getStartedAt()).isEqualTo(LATER);
        assertThat(job.getLastMismatches()).isEqualTo(3);
    }

    @Test
    void recordBatch_movesLastId_addsTheCounts_andResetsTheFailures() {
        // setup
        EventJob job = EventJob.neverRun("reconciliation:tickets");
        job = job.startRun("run-1", NOW);
        job = job.recordBatch("id-500", 500, 3, NOW);
        job = job.recordFailure("boom", NOW);

        // execution
        job = job.recordBatch("id-800", 300, 2, LATER);

        // verifications
        assertThat(job.getLastId()).isEqualTo("id-800");
        assertThat(job.getProcessed()).isEqualTo(800);
        assertThat(job.getMismatches()).isEqualTo(5);
        assertThat(job.getFailures()).isZero();
        assertThat(job.getUpdatedAt()).isEqualTo(LATER);
    }

    @Test
    void recordFailure_countsFailuresInARow() {
        // setup
        EventJob job = EventJob.neverRun("backfill:organizations");
        job = job.startRun("run-1", NOW);
        job = job.recordFailure("first", NOW);

        // execution
        job = job.recordFailure("second", LATER);

        // verifications
        assertThat(job.getFailures()).isEqualTo(2);
        assertThat(job.getLastError()).isEqualTo("second");
    }

    @Test
    void finishingDone_keepsTheMismatchesAsTheLastResult() {
        // setup
        EventJob job = EventJob.neverRun("reconciliation:tickets");
        job = job.startRun("run-1", NOW);
        job = job.recordBatch("id-500", 500, 4, NOW);

        // execution
        job = job.finishRun(EventJobStatus.DONE, LATER);

        // verifications
        assertThat(job.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(job.getLastMismatches()).isEqualTo(4);
        assertThat(job.getFinishedAt()).isEqualTo(LATER);
    }

    @Test
    void finishingFailed_keepsTheErrorAndTheLastResultOfTheRunBefore() {
        // setup
        EventJob job = EventJob.neverRun("reconciliation:tickets");
        job = job.startRun("run-1", NOW);
        job = job.recordBatch("id-500", 500, 4, NOW);
        job = job.recordFailure("boom", NOW);

        // execution
        job = job.finishRun(EventJobStatus.FAILED, LATER);

        // verifications
        assertThat(job.getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(job.getLastError()).isEqualTo("boom");
        assertThat(job.getLastMismatches()).isZero();
        assertThat(job.getLastId()).isEqualTo("id-500");
    }

    @Test
    void resumeRun_makesAFailedRunRunningAgain_andKeepsItsProgress() {
        // setup
        EventJob job = EventJob.neverRun("backfill:organizations");
        job = job.startRun("run-1", NOW);
        job = job.recordBatch("id-500", 500, 0, NOW);
        job = job.recordFailure("boom", NOW);
        job = job.finishRun(EventJobStatus.FAILED, NOW);

        // execution
        job = job.resumeRun(LATER);

        // verifications
        assertThat(job.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(job.getFailures()).isZero();
        assertThat(job.getLastError()).isNull();
        assertThat(job.getFinishedAt()).isNull();
        assertThat(job.getLastId()).isEqualTo("id-500");
        assertThat(job.getProcessed()).isEqualTo(500);
    }

    @Test
    void startRun_isANewDocument_namedByTheJobAndTheRun() {
        // setup
        EventJob first = EventJob.neverRun("backfill:organizations").startRun("run-1", NOW);
        first.setVersion(3L);

        // execution
        EventJob second = first.startRun("run-2", LATER);

        // verifications
        assertThat(first.getId()).isEqualTo("backfill:organizations:run-1");
        assertThat(second.getId()).isEqualTo("backfill:organizations:run-2");
        assertThat(second.getJobId()).isEqualTo("backfill:organizations");
        assertThat(second.getVersion()).isNull();
    }

    @Test
    void onlyARunningRun_isRunning() {
        // setup
        EventJob running = EventJob.neverRun("backfill:organizations").startRun("run-1", NOW);

        EventJob neverRan = EventJob.neverRun("backfill:organizations");

        // execution
        EventJob failed = running.finishRun(EventJobStatus.FAILED, LATER);

        // verifications
        assertThat(running.isRunning()).isTrue();
        assertThat(failed.isRunning()).isFalse();
        assertThat(neverRan.isRunning()).isFalse();
    }
}
