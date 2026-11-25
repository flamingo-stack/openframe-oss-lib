package com.openframe.api.datafetcher;

import com.openframe.api.dto.device.DeviceWipe;
import com.openframe.api.dto.device.DeviceWipeStatus;
import com.openframe.api.service.device.DeviceWipeService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.prepost.PreAuthorize;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceWipeDataFetcherTest {

    private static final String MACHINE_ID = "machine-1";

    @Mock private DeviceWipeService deviceWipeService;

    @InjectMocks
    private DeviceWipeDataFetcher dataFetcher;

    @Test
    void deviceWipe_returnsTheServiceAnswer() {
        // setup
        DeviceWipe wipe = new DeviceWipe(true, DeviceWipeStatus.NOT_REQUESTED);
        when(deviceWipeService.getWipe(MACHINE_ID)).thenReturn(wipe);

        // execution
        DeviceWipe result = dataFetcher.deviceWipe(MACHINE_ID);

        // verifications
        assertThat(result).isSameAs(wipe);
    }

    @Test
    void wipeDevice_requestsTheWipe() {
        // setup
        DeviceWipe pending = new DeviceWipe(false, DeviceWipeStatus.PENDING);
        when(deviceWipeService.wipe(MACHINE_ID)).thenReturn(pending);

        // execution
        DeviceWipe result = dataFetcher.wipeDevice(MACHINE_ID);

        // verifications
        assertThat(result).isSameAs(pending);
    }

    @Test
    void wipeDevice_isAdminOnly() throws Exception {
        // execution
        PreAuthorize preAuthorize = DeviceWipeDataFetcher.class
                .getMethod("wipeDevice", String.class)
                .getAnnotation(PreAuthorize.class);

        // verifications
        assertThat(preAuthorize).isNotNull();
        assertThat(preAuthorize.value()).isEqualTo("hasAuthority('ADMIN')");
    }
}
