package com.openframe.event.jobs.task.service;

import com.openframe.event.jobs.core.persistence.EventJobStatus;
import com.openframe.event.jobs.task.fixture.Widgets;
import com.openframe.event.jobs.task.fixture.Widgets.WidgetEvent;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
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
import org.springframework.dao.OptimisticLockingFailureException;
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
    private static final String TASK_ID = "widget-copies:tenant-a:widget-doc-1";
    private static final Instant NOW = Instant.parse("2026-10-22T10:00:00Z");
    private static final Instant RENAMED_AT = Instant.parse("2026-10-22T09:59:00Z");

    @Autowired
    private ProjectionTaskRepository repository;

    private ProjectionTaskEnvelopes envelopes;
    private ProjectionTaskService service;

    @BeforeEach
    @SuppressWarnings("unchecked")
    void setUp() {
        repository.deleteAll();
        Projection<WidgetEvent, Object> projection = mock(Projection.class);
        AggregateSpecRegistry specRegistry = Widgets.registryWith(projection);
        envelopes = new ProjectionTaskEnvelopes(specRegistry);
        service = serviceAt(NOW);
    }

    @Test
    void aSubmittedEvent_opensATask_whoseEnvelopeReadsBackIntoTheSpecsEventClass() {
        // execution
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "New name", RENAMED_AT));

        // verifications
        ProjectionTask stored = service.findTask(TASK_ID);
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
    void aNewerEvent_startsTheTaskAgainFromTheFirstItem_withItsEnvelope() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask opened = service.findTask("widget-copies:tenant-a:widget-doc-1");
        service.saveBatch(opened, "w500");

        // execution
        serviceAt(NOW.plusSeconds(60)).submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // verifications
        ProjectionTask stored = service.findTask(TASK_ID);
        assertThat(stored.getLastId()).isNull();
        assertThat(stored.getEventVersion()).isEqualTo(5L);
        assertThat(stored.getCreatedAt()).isEqualTo(NOW);
        assertThat(stored.getStartedAt()).isEqualTo(NOW.plusSeconds(60));
        WidgetEvent event = (WidgetEvent) envelopes.toRecord(stored).getEvent();
        assertThat(event.getName()).isEqualTo("Newer");
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void afterANewerEvent_aWorkersOlderCopyFailsToSave() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask workerCopy = service.findTask("widget-copies:tenant-a:widget-doc-1");
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // execution
        Throwable failure = catchThrowable(() -> service.saveBatch(workerCopy, "w500"));

        // verifications
        assertThat(failure).isInstanceOf(OptimisticLockingFailureException.class);
        assertThat(service.findTask(TASK_ID).getLastId()).isNull();
    }

    @Test
    void aFinishedTask_isDeleted_unlessANewerEventStartedItAgain() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask done = service.findTask("widget-copies:tenant-a:widget-doc-1");
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-2",
                record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask finishedMeanwhile = service.findTask("widget-copies:tenant-a:widget-doc-2");
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-2", record("tenant-a", 5, "Newer", RENAMED_AT));

        // execution
        ProjectionTask finished = service.finish(done);
        ProjectionTask restarted = service.finish(finishedMeanwhile);

        // verifications
        assertThat(finished.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(restarted.getStatus()).isEqualTo(EventJobStatus.DONE);
        assertThat(service.hasTask(PROJECTION, "tenant-a", "widget-doc-1")).isFalse();
        assertThat(service.hasTask(PROJECTION, "tenant-a", "widget-doc-2")).isTrue();
        assertThat(service.findTask("widget-copies:tenant-a:widget-doc-2").getStatus()).isEqualTo(EventJobStatus.RUNNING);
    }

    @Test
    void aFailedTask_stillTakesTheEventsOfItsSource_andTheNextOneRunsItAgain() {
        // setup
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 4, "Old", RENAMED_AT));
        ProjectionTask opened = service.findTask("widget-copies:tenant-a:widget-doc-1");
        service.finishRun(opened, EventJobStatus.FAILED);

        // execution
        boolean hasTaskWhileFailed = service.hasTask(PROJECTION, "tenant-a", "widget-doc-1");
        boolean runningWhileFailed = !service.runningTasks().isEmpty();
        service.submit(PROJECTION, Widgets.TYPE, "widget-doc-1", record("tenant-a", 5, "Newer", RENAMED_AT));

        // verifications
        assertThat(hasTaskWhileFailed).isTrue();
        assertThat(runningWhileFailed).isFalse();
        assertThat(service.runningTasks()).extracting(ProjectionTask::getId).containsExactly(TASK_ID);
    }

    @Test
    void theOpenTasksAndTheOldestOnesAge_areCountedPerProjection() {
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
