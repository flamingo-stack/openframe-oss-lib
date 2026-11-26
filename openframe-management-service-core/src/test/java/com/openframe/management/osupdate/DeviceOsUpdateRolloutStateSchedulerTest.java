package com.openframe.management.osupdate;

import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateRolloutStateSchedulerTest {

    @Mock private DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;

    @InjectMocks private DeviceOsUpdateRolloutStateScheduler deviceOsUpdateRolloutStateScheduler;

    @Test
    void run_refreshesTheRolloutStatesOfEveryDevice() {
        // execution
        deviceOsUpdateRolloutStateScheduler.run();

        // verifications
        verify(deviceOsUpdateRolloutStateService).refreshAll();
    }

    @Test
    void run_refreshFails_doesNotThrowSoTheNextRunStillHappens() {
        // setup
        doThrow(new IllegalStateException("mongo down")).when(deviceOsUpdateRolloutStateService).refreshAll();

        // execution, verifications
        assertThatCode(deviceOsUpdateRolloutStateScheduler::run).doesNotThrowAnyException();
    }
}
