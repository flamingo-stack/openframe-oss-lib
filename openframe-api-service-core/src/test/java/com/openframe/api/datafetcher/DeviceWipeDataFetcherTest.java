package com.openframe.api.datafetcher;

import com.openframe.api.dto.device.WipeWindowsDeviceInput;
import com.openframe.api.service.device.DeviceWipeService;
import com.openframe.data.document.device.Machine;
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
    private static final String CONFIRMATION = "DESKTOP-7Q2K9";

    @Mock private DeviceWipeService deviceWipeService;

    @InjectMocks
    private DeviceWipeDataFetcher dataFetcher;

    @Test
    void wipeWindowsDevice_passesMachineAndConfirmationAndReturnsTheDevice() {
        // setup
        Machine machine = new Machine();
        when(deviceWipeService.wipeWindowsDevice(MACHINE_ID, CONFIRMATION)).thenReturn(machine);

        // execution
        Machine result = dataFetcher.wipeWindowsDevice(new WipeWindowsDeviceInput(MACHINE_ID, CONFIRMATION));

        // verifications
        assertThat(result).isSameAs(machine);
    }

    @Test
    void wipeWindowsDevice_isAdminOnly() throws Exception {
        // execution
        PreAuthorize preAuthorize = DeviceWipeDataFetcher.class
                .getMethod("wipeWindowsDevice", WipeWindowsDeviceInput.class)
                .getAnnotation(PreAuthorize.class);

        // verifications
        assertThat(preAuthorize).isNotNull();
        assertThat(preAuthorize.value()).isEqualTo("hasAuthority('ADMIN')");
    }
}
