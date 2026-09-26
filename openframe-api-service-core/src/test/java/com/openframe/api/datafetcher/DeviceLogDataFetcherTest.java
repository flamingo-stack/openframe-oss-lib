package com.openframe.api.datafetcher;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.device.DeviceLogEntry;
import com.openframe.api.mapper.GraphQLDeviceLogMapper;
import com.openframe.api.service.device.DeviceLogService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DeviceLogDataFetcherTest {

    @Mock private DeviceLogService deviceLogService;
    @Mock private GraphQLDeviceLogMapper mapper;
    @Captor private ArgumentCaptor<List<String>> devices;

    private DeviceLogDataFetcher fetcher;

    @BeforeEach
    void setUp() {
        fetcher = new DeviceLogDataFetcher(deviceLogService, mapper);
        when(deviceLogService.queryLogs(any(), any(), any()))
                .thenReturn(GenericQueryResult.<DeviceLogEntry>builder().items(List.of()).build());
    }

    @Test
    @DisplayName("the deprecated single-device argument still selects exactly that device")
    void passesTheLegacyArgumentThroughAsASingleDevice() {
        fetcher.deviceLogs("machine-1", null, null, null, null);

        assertThat(captureDevices()).containsExactly("machine-1");
    }

    @Test
    void passesAListOfDevicesThrough() {
        fetcher.deviceLogs(null, List.of("machine-1", "machine-2"), null, null, null);

        assertThat(captureDevices()).containsExactly("machine-1", "machine-2");
    }

    @Test
    void mergesTheLegacyArgumentIntoTheList() {
        fetcher.deviceLogs("machine-1", List.of("machine-2"), null, null, null);

        assertThat(captureDevices()).containsExactly("machine-1", "machine-2");
    }

    @Test
    @DisplayName("neither argument asks for every device of the tenant")
    void passesNoDevicesWhenNeitherArgumentIsGiven() {
        fetcher.deviceLogs(null, null, null, null, null);

        assertThat(captureDevices()).isNull();
    }

    @Test
    @DisplayName("a blank machineId is still rejected rather than silently widening to the whole tenant")
    void rejectsABlankLegacyArgument() {
        assertThatThrownBy(() -> fetcher.deviceLogs("  ", null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);

        verifyNoInteractions(deviceLogService);
    }

    private List<String> captureDevices() {
        // The mapper is a mock, so filter and pagination arrive as nulls, which any(Class) would not match
        verify(deviceLogService).queryLogs(devices.capture(), any(), any());
        return devices.getValue();
    }
}
