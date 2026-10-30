package com.openframe.client.scheduler;

import com.openframe.client.service.agentregistration.fleet.FleetHostFactsBackfillService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.catchThrowable;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class FleetHostFactsBackfillSchedulerTest {

    @Mock
    private FleetHostFactsBackfillService backfillService;

    @InjectMocks
    private FleetHostFactsBackfillScheduler scheduler;

    @Test
    void run_scheduledTick_delegatesToTheBackfill() {
        // setup

        // execution
        scheduler.run();

        // verifications
        verify(backfillService).backfill();
    }

    @Test
    void run_backfillFails_failureLoggedNotThrown() {
        // setup
        doThrow(new IllegalStateException("Found no tool with id fleetmdm-server")).when(backfillService).backfill();

        // execution
        Throwable thrown = catchThrowable(scheduler::run);

        // verifications
        assertThat(thrown).isNull();
    }
}
