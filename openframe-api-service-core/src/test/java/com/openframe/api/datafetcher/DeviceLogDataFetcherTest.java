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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
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
        when(deviceLogService.queryLogs(any(), any(), any(), any()))
                .thenReturn(GenericQueryResult.<DeviceLogEntry>builder().items(List.of()).build());
    }

    @Test
    void passesAListOfDevicesThrough() {
        fetcher.deviceLogs(List.of("machine-1", "machine-2"), null, null, null, null);

        assertThat(captureDevices()).containsExactly("machine-1", "machine-2");
    }

    @Test
    @DisplayName("no devices named asks for every device of the tenant")
    void passesNoDevicesWhenNoneAreNamed() {
        fetcher.deviceLogs(null, null, null, null, null);

        assertThat(captureDevices()).isNull();
    }

    @Test
    void passesOrganizationsThroughAlongsideDevices() {
        fetcher.deviceLogs(List.of("machine-1"), List.of("org-1"), null, null, null);

        verify(deviceLogService).queryLogs(eq(List.of("machine-1")), eq(List.of("org-1")), any(), any());
    }

    private List<String> captureDevices() {
        // The mapper is a mock, so filter and pagination arrive as nulls, which any(Class) would not match
        verify(deviceLogService).queryLogs(devices.capture(), any(), any(), any());
        return devices.getValue();
    }
}
