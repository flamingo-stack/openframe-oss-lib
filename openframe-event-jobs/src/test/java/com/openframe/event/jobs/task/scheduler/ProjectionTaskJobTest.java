package com.openframe.event.jobs.task.scheduler;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.task.config.properties.ProjectionTaskProperties;
import com.openframe.event.jobs.task.persistence.ProjectionTask;
import com.openframe.event.jobs.task.service.ProjectionTaskRunner;
import com.openframe.event.jobs.task.service.ProjectionTaskService;
import com.openframe.publishing.api.spec.Projection;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static com.openframe.event.jobs.reconciliation.fixture.Projections.named;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ProjectionTaskJobTest {

    private static final Projection<?, ?> TICKETS = named("organization-on-tickets");
    private static final String FIRST = "organization-on-tickets:tenant-a:org-doc-1";
    private static final String SECOND = "organization-on-tickets:tenant-b:org-doc-2";

    private final EventJobLock jobLock = mock(EventJobLock.class);
    private final ProjectionTaskService taskService = mock(ProjectionTaskService.class);
    private final ProjectionTaskRunner runner = mock(ProjectionTaskRunner.class);
    private final ProjectionTaskJob job = new ProjectionTaskJob(new ProjectionTaskProperties(), List.of(TICKETS), jobLock,
            taskService, runner);

    @BeforeEach
    void setUp() {
        List<ProjectionTask> running = List.of(ProjectionTask.gone(FIRST), ProjectionTask.gone(SECOND));
        when(taskService.runningTasks()).thenReturn(running);
        doAnswer(invocation -> {
            Runnable work = invocation.getArgument(2);
            work.run();
            return null;
        }).when(jobLock).runExclusively(anyString(), any(), any());
    }

    @Test
    void eachRunningTask_isWorkedUnderItsOwnLock_afterTheOpenTasksAreReported() {
        // execution
        job.runAll();

        // verifications
        verify(runner).reportOpenTasks(TICKETS);
        verify(jobLock).runExclusively(eq("projection-task:" + FIRST), eq(Duration.ofMinutes(2)), any());
        verify(jobLock).runExclusively(eq("projection-task:" + SECOND), eq(Duration.ofMinutes(2)), any());
        verify(runner).applyBatches(FIRST);
        verify(runner).applyBatches(SECOND);
    }

    @Test
    void oneTasksError_isLogged_andTheOtherTasksStillRun() {
        // setup
        doThrow(new IllegalStateException("mongo down")).when(runner).applyBatches(FIRST);
        doThrow(new IllegalStateException("mongo down")).when(runner).reportOpenTasks(TICKETS);

        // execution
        job.runAll();

        // verifications
        verify(runner).applyBatches(SECOND);
    }
}
