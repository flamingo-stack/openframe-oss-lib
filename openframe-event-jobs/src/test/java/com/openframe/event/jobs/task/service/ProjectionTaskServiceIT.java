package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.task.fixture.Widgets;
import com.openframe.event.jobs.task.fixture.Widgets.WidgetEvent;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.persistence.ProjectionTaskIndexInitializer;
import com.openframe.event.jobs.task.repository.ProjectionTaskRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.spec.Projection;
import com.openframe.publishing.registry.AggregateSpecRegistry;
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
import org.springframework.data.mongodb.repository.config.EnableMongoRepositories;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mongodb.MongoDBContainer;
import org.testcontainers.utility.DockerImageName;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Map;

import static com.openframe.event.jobs.task.fixture.Widgets.record;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.mock;

@SpringBootTest(classes = ProjectionTaskServiceIT.TestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
@Testcontainers
class ProjectionTaskServiceIT {

    @Container
    static final MongoDBContainer MONGO = new MongoDBContainer(DockerImageName.parse("mongo:7"));

    @DynamicPropertySource
    static void mongoProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.mongodb.uri", MONGO::getConnectionString);
        registry.add("spring.mongodb.database", () -> "projection_tasks_it");
    }

    private static final String PROJECTION = "widget-copies";
    private static final String KEY = "widget-copies:tenant-a:widget-doc-1";
    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private static final Instant RENAMED_AT = Instant.parse("2026-10-22T09:59:00Z");

    @Autowired
    private ProjectionTaskRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    private ProjectionTaskEnvelopes envelopes;
    private ProjectionTaskService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        repository.deleteAll();
        new ProjectionTaskIndexInitializer(mongoTemplate).start();
        Projection<WidgetEvent, Object> projection = mock(Projection.class);
        AggregateSpecRegistry specRegistry = Widgets.registryWith(projection);
        envelopes = new ProjectionTaskEnvelopes(specRegistry);
        service = serviceAt(NOW);
    }

    @Test
    void aSubmittedEvent_opensARun_whoseEnvelopeReadsBackIntoTheSpecsEventClass() {
        // execution
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "New name", RENAMED_AT));

        // verifications
        ProjectionTask stored = currentRun(KEY);
        assertThat(stored.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(stored.getTenantId()).isEqualTo("tenant-a");
        assertThat(stored.getSourceId()).isEqualTo("widget-doc-1");
        PublishedRecord<?> read = envelopes.toRecord(stored);
        assertThat(read.getTenantId()).isEqualTo("tenant-a");
        assertThat(read.getVersion()).isEqualTo(4L);
        assertThat(read.getEvent()).isInstanceOf(WidgetEvent.class);
        WidgetEvent event = (WidgetEvent) read.getEvent();
        assertThat(event.getName()).isEqualTo("New name");
        assertThat(event.getRenamedAt()).isEqualTo(RENAMED_AT);
    }

    @Test
    void aNewerEvent_endsTheRunReplaced_andOpensANewRunFromTheFirstItem() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask firstRun = currentRun(KEY);
        service.saveBatch(firstRun, "w500");

        // execution
        serviceAt(NOW.plusSeconds(60)).submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // verifications
        ProjectionTask secondRun = currentRun(KEY);
        assertThat(secondRun.getLastId()).isNull();
        assertThat(secondRun.getEventVersion()).isEqualTo(5L);
        assertThat(secondRun.getStartedAt()).isEqualTo(NOW.plusSeconds(60));
        WidgetEvent event = (WidgetEvent) envelopes.toRecord(secondRun).getEvent();
        assertThat(event.getName()).isEqualTo("Newer");
        ProjectionTask replaced = service.findTask(firstRun.getId());
        assertThat(replaced.getStatus()).isEqualTo(EventJobStatus.REPLACED);
        assertThat(replaced.isCurrent()).isFalse();
        assertThat(replaced.getLastId()).isEqualTo("w500");
        assertThat(repository.count()).isEqualTo(2);
    }

    @Test
    void anOlderEvent_keepsTheNewerCurrentRun_soTwoConsumersAfterARebalanceCannotGoBack() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 6, "Newer", RENAMED_AT));
        ProjectionTask newerRun = currentRun(KEY);

        // execution
        serviceAt(NOW.plusSeconds(60)).submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Older", RENAMED_AT));

        // verifications
        ProjectionTask current = currentRun(KEY);
        assertThat(current.getId()).isEqualTo(newerRun.getId());
        assertThat(current.getEventVersion()).isEqualTo(6L);
        assertThat(current.getStatus()).isEqualTo(EventJobStatus.RUNNING);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void afterANewerEvent_aWorkersCopyOfTheOldRunFailsToSave() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask workerCopy = currentRun(KEY);
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // execution
        Throwable failure = catchThrowable(() -> service.saveBatch(workerCopy, "w500"));

        // verifications
        assertThat(failure).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(currentRun(KEY).getLastId()).isNull();
    }

    @Test
    void aSecondCurrentRunOfTheSameSource_isRefusedByTheIndex() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask secondCurrent = ProjectionTask.open(PROJECTION, Widgets.TYPE, "tenant-a", "widget-doc-1", Map.of(), 5, NOW);

        // execution
        Throwable failure = catchThrowable(() -> repository.insert(secondCurrent));

        // verifications
        assertThat(failure).isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    void aFinishedRun_isKeptDone_unlessANewerEventClosedItMeanwhile() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask done = currentRun(KEY);
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-2", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask closedMeanwhile = currentRun("widget-copies:tenant-a:widget-doc-2");
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-2", record("tenant-a", 5, "Newer", RENAMED_AT));

        // execution
        service.finish(done);
        service.finish(closedMeanwhile);

        // verifications
        assertThat(service.findTask(done.getId()).getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(service.findTask(done.getId()).getFinishedAt()).isEqualTo(NOW);
        assertThat(service.hasTask(PROJECTION, "tenant-a", "widget-doc-1")).isFalse();
        assertThat(service.findTask(closedMeanwhile.getId()).getStatus()).isEqualTo(EventJobStatus.REPLACED);
        assertThat(service.hasTask(PROJECTION, "tenant-a", "widget-doc-2")).isTrue();
        assertThat(currentRun("widget-copies:tenant-a:widget-doc-2").getStatus()).isEqualTo(EventJobStatus.RUNNING);
    }

    @Test
    void aFailedRun_stillTakesTheEventsOfItsSource_andTheNextOneOpensANewRun() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask opened = currentRun(KEY);
        service.finishRun(opened, EventJobStatus.FAILED);

        // execution
        boolean hasTaskWhileFailed = service.hasTask(PROJECTION, "tenant-a", "widget-doc-1");
        boolean runningWhileFailed = !service.runningTasks().isEmpty();
        serviceAt(NOW.plusSeconds(60)).submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // verifications
        assertThat(hasTaskWhileFailed).isTrue();
        assertThat(runningWhileFailed).isFalse();
        assertThat(service.findTask(opened.getId()).getStatus()).isEqualTo(EventJobStatus.FAILED);
        assertThat(service.runningTasks()).extracting(ProjectionTask::getEventVersion).containsExactly(5L);
    }

    @Test
    void theRunningRunsAndTheOldestOnesAge_areCountedPerProjection() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        serviceAt(NOW.plusSeconds(30)).submit(PROJECTION, Widgets.TYPE, "widget-doc-2", record("tenant-b", 4, "Old", RENAMED_AT));
        ProjectionTaskService ninetySecondsLater = serviceAt(NOW.plusSeconds(90));

        // execution
        long open = ninetySecondsLater.countRunning(PROJECTION);
        Duration oldestAge = ninetySecondsLater.oldestRunningAge(PROJECTION);

        // verifications
        assertThat(open).isEqualTo(2);
        assertThat(oldestAge).isEqualTo(Duration.ofSeconds(90));
        assertThat(ninetySecondsLater.countRunning("other-projection")).isZero();
        assertThat(ninetySecondsLater.oldestRunningAge("other-projection")).isZero();
    }

    private ProjectionTask currentRun(String key) {
        return repository.findByKeyAndCurrentTrue(key).orElseThrow();
    }

    private ProjectionTaskService serviceAt(Instant now) {
        Clock clock = Clock.fixed(now, ZoneOffset.UTC);
        return new ProjectionTaskService(repository, envelopes, clock);
    }

    @SpringBootConfiguration
    @EnableAutoConfiguration
    @EnableMongoRepositories(basePackageClasses = ProjectionTaskRepository.class)
    static class TestApplication {
    }
}
