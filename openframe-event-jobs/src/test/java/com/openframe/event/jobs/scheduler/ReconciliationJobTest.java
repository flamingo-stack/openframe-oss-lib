package com.openframe.event.jobs.scheduler;

import com.openframe.event.jobs.config.properties.ReconciliationProperties;
import com.openframe.event.jobs.lock.EventJobLock;
import com.openframe.event.jobs.reconciliation.MappedCopy;
import com.openframe.event.jobs.reconciliation.ReconciliationService;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

class ReconciliationJobTest {

    private static final MappedCopy TICKETS = MappedCopy.builder().name("tickets.organizationName").build();

    private final EventJobLock jobLock = mock(EventJobLock.class);
    private final ReconciliationService reconciliationService = mock(ReconciliationService.class);
    private final ReconciliationJob job = new ReconciliationJob(new ReconciliationProperties(), List.of(TICKETS), jobLock,
            reconciliationService);

    @Test
    void eachCopy_reportsItsLastResult_andIsReconciledUnderTheLockOfItsJob() {
        // setup
        doAnswer(invocation -> {
            Runnable reconcile = invocation.getArgument(2);
            reconcile.run();
            return null;
        }).when(jobLock).runExclusively(anyString(), any(), any());

        // execution
        job.runAll();

        // verifications
        verify(reconciliationService).reportLastResult(TICKETS, "reconciliation:tickets.organizationName");
        verify(jobLock).runExclusively(eq("reconciliation:tickets.organizationName"), eq(Duration.ofMinutes(2)), any());
        verify(reconciliationService).reconcile(TICKETS, "reconciliation:tickets.organizationName");
    }

    @Test
    void oneCopysError_isLogged_andTheOtherCopiesStillRun() {
        // setup
        MappedCopy index = MappedCopy.builder().name("directory_connection_search_index.organizationNameLower").build();
        ReconciliationJob twoCopies = new ReconciliationJob(new ReconciliationProperties(), List.of(TICKETS, index), jobLock,
                reconciliationService);
        doThrow(new IllegalStateException("mongo down")).when(reconciliationService)
                .reportLastResult(TICKETS, "reconciliation:tickets.organizationName");

        // execution
        twoCopies.runAll();

        // verifications
        verify(reconciliationService).reportLastResult(index, "reconciliation:directory_connection_search_index.organizationNameLower");
    }
}
