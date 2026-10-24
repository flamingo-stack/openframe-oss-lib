package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJob;
import com.openframe.event.jobs.core.persistence.EventJobRunIndexInitializer;
import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.core.repository.EventJobRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;

@SpringBootTest(classes = EventJobServiceIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Testcontainers
class EventJobServiceIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "event_jobs_it");
    }

    private static final String JOB = "backfill:organizations";
    private static final Instant NOW = Instant.parse("2026-10-21T10:00:00Z");

    @Autowired
    private EventJobRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    private EventJobService service;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        service = new EventJobService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void aJobThatNeverRan_isNewAndUnsaved() {
        // execution
        EventJob job = service.findCurrentRun(JOB);

        // verifications
        assertThat(job.getJobId()).isEqualTo(JOB);
        assertThat(job.getStatus()).isNull();
        assertThat(repository.count()).isZero();
    }

    @Test
    void theProgressOfARun_isSavedAndReadBack() {
        // setup
        EventJob started = service.startRun(service.findCurrentRun(JOB), "run-1");

        // execution
        service.saveBatch(started, "id-500", 500, 2);
        EventJob stored = service.findCurrentRun(JOB);

        // verifications
        assertThat(stored.getRunId()).isEqualTo("run-1");
        assertThat(stored.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(stored.getLastId()).isEqualTo("id-500");
        assertThat(stored.getProcessed()).isEqualTo(500);
        assertThat(stored.getMismatches()).isEqualTo(2);
        assertThat(stored.getStartedAt()).isEqualTo(NOW);
    }

    @Test
    void aNewRun_endsTheRunningOneReplaced_keepsBoth_andAPodWithTheOldCopyCannotOverwriteIt() {
        // setup
        EventJob podA = service.startRun(service.findCurrentRun(JOB), "run-1");
        EventJob podB = service.findCurrentRun(JOB);
        Clock aMinuteLater = Clock.fixed(NOW.plusSeconds(60), ZoneOffset.UTC);
        EventJobService serviceOfPodB = new EventJobService(repository, aMinuteLater);

        // execution
        serviceOfPodB.startRun(podB, "run-2");
        Throwable staleSave = catchThrowable(() -> service.saveBatch(podA, "id-500", 500, 0));

        // verifications
        assertThat(staleSave).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(repository.count()).isEqualTo(2);
        assertThat(repository.findById(JOB + ":run-1")).get().extracting(EventJob::getStatus).isEqualTo(EventJobStatus.REPLACED);
        assertThat(service.findCurrentRun(JOB).getRunId()).isEqualTo("run-2");
        assertThat(service.hasRun(JOB, "run-1")).isTrue();
        assertThat(service.hasRun(JOB, "run-3")).isFalse();
    }

    @Test
    void aSecondPodStartingTheSameRun_failsItsInsert() {
        // setup
        EventJob neverRan = service.findCurrentRun(JOB);
        service.startRun(neverRan, "run-1");

        // execution
        Throwable secondStart = catchThrowable(() -> service.startRun(neverRan, "run-1"));

        // verifications
        assertThat(secondStart).isInstanceOf(DuplicateKeyException.class);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void theIndexInitializer_createsTheNewestRunIndex() {
        // execution
        new EventJobRunIndexInitializer(mongoTemplate).start();

        // verifications
        List<IndexInfo> indexes = mongoTemplate.indexOps(EventJob.class).getIndexInfo();
        assertThat(indexes).extracting(IndexInfo::getName).contains("event_job_runs_jobId_startedAt");
    }

    @Test
    void recordFailure_countsTheFailuresInARow() {
        // setup
        EventJob job = service.startRun(service.findCurrentRun(JOB), "run-1");
        EventJob once = service.recordFailure(job, "first");

        // execution
        EventJob twice = service.recordFailure(once, "second");

        // verifications
        assertThat(twice.getFailures()).isEqualTo(2);
        assertThat(service.findCurrentRun(JOB).getLastError()).isEqualTo("second");
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = EventJobRepository.class)
    static class TestApplication {
    }
}
