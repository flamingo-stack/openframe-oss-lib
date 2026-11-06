package com.openframe.event.jobs.reconciliation.scheduler;

import com.openframe.event.jobs.core.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.reconciliation.service.ReconciliationService;
import com.openframe.publishing.api.spec.Projection;
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

class ReconciliationJobTest {

    private static final Projection<?, ?> TICKETS = named("organization-on-tickets");

    private final EventJobLock jobLock = mock(EventJobLock.class);
    private final ReconciliationService reconciliationService = mock(ReconciliationService.class);
    private final ReconciliationJob job = new ReconciliationJob(new ReconciliationProperties(), List.of(TICKETS), jobLock,
            reconciliationService);

    @Test
    void eachProjection_reportsItsLastResult_andIsReconciledUnderTheLockOfItsJob() {
        // setup
        doAnswer(invocation -> {
            Runnable reconcile = invocation.getArgument(2);
            reconcile.run();
            return null;
        }).when(jobLock).runExclusively(anyString(), any(), any());

        // execution
        job.runAll();

        // verifications
        verify(reconciliationService).reportLastResult(TICKETS, "reconciliation:organization-on-tickets");
        verify(jobLock).runExclusively(eq("reconciliation:organization-on-tickets"), eq(Duration.ofMinutes(2)), any());
        verify(reconciliationService).reconcile(TICKETS, "reconciliation:organization-on-tickets");
    }

    @Test
    void oneProjectionsError_isLogged_andTheOtherProjectionsStillRun() {
        // setup
        Projection<?, ?> other = named("other-projection");
        ReconciliationJob twoProjections = new ReconciliationJob(new ReconciliationProperties(), List.of(TICKETS, other), jobLock,
                reconciliationService);
        doThrow(new IllegalStateException("mongo down")).when(reconciliationService)
                .reportLastResult(TICKETS, "reconciliation:organization-on-tickets");

        // execution
        twoProjections.runAll();

        // verifications
        verify(reconciliationService).reportLastResult(other, "reconciliation:other-projection");
    }
}
