package com.openframe.management.osupdate;

import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateRolloutStateSchedulerTest {

    private static final String RUN_DURATION_TIMER = "openframe.rmm.os_update.rollout.duration";
    private static final String ERRORS_COUNTER = "openframe.rmm.os_update.rollout.errors";

    @Mock private DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;

    private SimpleMeterRegistry meterRegistry;
    private DeviceOsUpdateRolloutStateScheduler deviceOsUpdateRolloutStateScheduler;

    @BeforeEach
    void setUp() {
        meterRegistry = new SimpleMeterRegistry();
        deviceOsUpdateRolloutStateScheduler = new DeviceOsUpdateRolloutStateScheduler(
                deviceOsUpdateRolloutStateService, new DeviceOsUpdateRolloutStateMetrics(meterRegistry));
    }

    @Test
    void run_refreshesTheRolloutStatesOfEveryDeviceAndTimesTheRun() {
        // execution
        deviceOsUpdateRolloutStateScheduler.run();

        // verifications
        verify(deviceOsUpdateRolloutStateService).refreshAll();
        assertThat(meterRegistry.get(RUN_DURATION_TIMER).timer().count()).isEqualTo(1);
        assertThat(meterRegistry.find(ERRORS_COUNTER).counter()).isNull();
    }

    @Test
    void run_refreshFails_doesNotThrowSoTheNextRunStillHappensAndCountsTheFailure() {
        // setup
        doThrow(new IllegalStateException("mongo down")).when(deviceOsUpdateRolloutStateService).refreshAll();

        // execution, verifications
        assertThatCode(deviceOsUpdateRolloutStateScheduler::run).doesNotThrowAnyException();
        assertThat(meterRegistry.get(ERRORS_COUNTER).tag("stage", "run").counter().count()).isEqualTo(1);
        assertThat(meterRegistry.get(RUN_DURATION_TIMER).timer().count()).isEqualTo(1);
    }
}
