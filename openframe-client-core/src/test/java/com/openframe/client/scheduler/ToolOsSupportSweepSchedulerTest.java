package com.openframe.client.scheduler;

import com.openframe.client.service.ToolOsSupportSweepService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class ToolOsSupportSweepSchedulerTest {

    @Mock private ToolOsSupportSweepService sweepService;

    @InjectMocks private ToolOsSupportSweepScheduler scheduler;

    @Test
    void run_tick_sweepRun() {
        // setup

        // execution
        scheduler.run();

        // verifications
        verify(sweepService).sweep();
    }

    @Test
    void run_sweepThrows_swallowed() {
        // setup
        doThrow(new IllegalStateException("mongo away")).when(sweepService).sweep();

        // execution
        assertThatCode(() -> scheduler.run()).doesNotThrowAnyException();

        // verifications
        verify(sweepService).sweep();
    }
}
