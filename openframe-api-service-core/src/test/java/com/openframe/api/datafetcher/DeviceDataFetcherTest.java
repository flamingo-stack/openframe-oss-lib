package com.openframe.api.datafetcher;

import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.DeviceFilterService;
import com.openframe.api.service.DeviceService;
import com.openframe.api.service.TagService;
import com.openframe.data.document.device.Machine;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceDataFetcherTest {

    @Mock private DeviceService deviceService;
    @Mock private DeviceFilterService deviceFilterService;
    @Mock private TagService tagService;
    @Mock private GraphQLDeviceMapper mapper;

    @InjectMocks private DeviceDataFetcher fetcher;

    @Test
    @DisplayName("updateDeviceNickname: delegates to DeviceService.updateNickname and returns the updated device")
    void updateDeviceNickname_delegates() {
        Machine updated = new Machine();
        updated.setMachineId("m1");
        updated.setNickname("Reception iMac");
        when(deviceService.updateNickname("m1", "Reception iMac")).thenReturn(updated);

        Machine result = fetcher.updateDeviceNickname("m1", "Reception iMac");

        assertThat(result).isSameAs(updated);
        assertThat(result.getNickname()).isEqualTo("Reception iMac");
        verify(deviceService).updateNickname("m1", "Reception iMac");
    }

    @Test
    @DisplayName("updateDeviceNickname: passes a null nickname through to clear it")
    void updateDeviceNickname_null() {
        Machine updated = new Machine();
        updated.setMachineId("m1");
        when(deviceService.updateNickname("m1", null)).thenReturn(updated);

        Machine result = fetcher.updateDeviceNickname("m1", null);

        assertThat(result.getNickname()).isNull();
        verify(deviceService).updateNickname("m1", null);
    }
}
