package com.openframe.event.jobs.core.service;

import com.openframe.event.jobs.core.persistence.EventJob;
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
import org.springframework.dao.OptimisticLockingFailureException;
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

    private EventJobService service;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        service = new EventJobService(repository, Clock.fixed(NOW, ZoneOffset.UTC));
    }

    @Test
    void aJobThatNeverRan_isNewAndUnsaved() {
        // execution
        EventJob job = service.jobOf(JOB);

        // verifications
        assertThat(job.getId()).isEqualTo(JOB);
        assertThat(job.getStatus()).isNull();
        assertThat(repository.count()).isZero();
    }

    @Test
    void theProgressOfARun_isSavedAndReadBack() {
        // setup
        EventJob started = service.startRun(service.jobOf(JOB), "run-1");

        // execution
        service.saveBatch(started, "id-500", 500, 2);
        EventJob stored = service.jobOf(JOB);

        // verifications
        assertThat(stored.getRunId()).isEqualTo("run-1");
        assertThat(stored.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(stored.getLastId()).isEqualTo("id-500");
        assertThat(stored.getProcessed()).isEqualTo(500);
        assertThat(stored.getMismatches()).isEqualTo(2);
        assertThat(stored.getStartedAt()).isEqualTo(NOW);
    }

    @Test
    void aPodWithAnOlderCopy_cannotOverwriteANewerRun_andItsCopyStaysStale() {
        // setup
        EventJob podA = service.startRun(service.jobOf(JOB), "run-1");
        EventJob podB = service.jobOf(JOB);
        service.startRun(podB, "run-2");

        // execution
        Throwable firstSave = catchThrowable(() -> service.saveBatch(podA, "id-500", 500, 0));
        Throwable secondSave = catchThrowable(() -> service.finishRun(podA, EventJobStatus.DONE));

        // verifications
        assertThat(firstSave).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(secondSave).isInstanceOf(OptimisticLockingFailureException.class);
        EventJob stored = service.jobOf(JOB);
        assertThat(stored.getRunId()).isEqualTo("run-2");
        assertThat(stored.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(stored.getLastId()).isNull();
    }

    @Test
    void recordFailure_countsTheFailuresInARow() {
        // setup
        EventJob job = service.startRun(service.jobOf(JOB), "run-1");
        EventJob once = service.recordFailure(job, "first");

        // execution
        EventJob twice = service.recordFailure(once, "second");

        // verifications
        assertThat(twice.getFailures()).isEqualTo(2);
        assertThat(service.jobOf(JOB).getLastError()).isEqualTo("second");
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = EventJobRepository.class)
    static class TestApplication {
    }
}
