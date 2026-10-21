package com.openframe.event.jobs.scheduler;

import com.openframe.event.jobs.backfill.EventBackfillService;
import com.openframe.event.jobs.config.properties.EventBackfillProperties;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.publishing.api.PublishedAggregateType;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.Map;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

class EventBackfillJobTest {

    private final EventBackfillProperties properties = new EventBackfillProperties();
    private final EventJobLock jobLock = mock(EventJobLock.class);
    private final EventBackfillService backfillService = mock(EventBackfillService.class);
    private final EventBackfillJob job = new EventBackfillJob(properties, jobLock, backfillService);

    @Test
    void eachConfiguredType_isBackfilledUnderTheLockOfItsJob() {
        // setup
        properties.setRuns(Map.of(PublishedAggregateType.ORGANIZATIONS, "run-1"));
        doAnswer(invocation -> {
            Runnable backfill = invocation.getArgument(2);
            backfill.run();
            return null;
        }).when(jobLock).runExclusively(anyString(), any(), any());

        // execution
        job.runAll();

        // verifications
        verify(jobLock).runExclusively(eq("backfill:organizations"), eq(Duration.ofMinutes(2)), any());
        verify(backfillService).backfill(PublishedAggregateType.ORGANIZATIONS, "run-1", "backfill:organizations");
    }

    @Test
    void oneTypesError_isLogged_andTheTickGoesOn() {
        // setup
        properties.setRuns(Map.of(PublishedAggregateType.ORGANIZATIONS, "run-1"));
        doThrow(new IllegalStateException("redis down")).when(jobLock).runExclusively(anyString(), any(), any());

        // execution
        Throwable failure = catchThrowable(job::runAll);

        // verifications
        assertThat(failure).isNull();
    }

    @Test
    void withoutRunIds_nothingRuns() {
        // execution
        job.runAll();

        // verifications
        verifyNoInteractions(jobLock, backfillService);
    }
}
