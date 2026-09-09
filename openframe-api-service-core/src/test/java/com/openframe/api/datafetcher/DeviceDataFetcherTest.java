package com.openframe.api.datafetcher;

import com.openframe.api.mapper.GraphQLDeviceMapper;
import com.openframe.api.service.device.DeviceFilterService;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.FleetVulnerabilityStatusService;
import com.openframe.api.service.TagService;
import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceDataFetcherTest {

    @Mock private DeviceService deviceService;
    @Mock private DeviceFilterService deviceFilterService;
    @Mock private TagService tagService;
    @Mock private GraphQLDeviceMapper mapper;
    @Mock private FleetVulnerabilityStatusService fleetVulnerabilityStatusService;
    @Mock private DgsDataFetchingEnvironment dfe;

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

    @Test
    @DisplayName("toolConnectionVulnerabilitiesUpdatedAt: FLEET_MDM connection delegates to the status service")
    void toolConnectionVulnerabilitiesUpdatedAt_fleetMdm_delegatesToService() {
        Instant lastRunAt = Instant.parse("2026-08-26T09:31:13Z");
        ToolConnection connection = new ToolConnection();
        connection.setToolType(ToolType.FLEET_MDM);
        when(dfe.getSource()).thenReturn(connection);
        when(fleetVulnerabilityStatusService.getLastCompletedVulnerabilityRunAt()).thenReturn(lastRunAt);

        Instant result = fetcher.toolConnectionVulnerabilitiesUpdatedAt(dfe);

        assertThat(result).isEqualTo(lastRunAt);
        verify(fleetVulnerabilityStatusService).getLastCompletedVulnerabilityRunAt();
    }

    @Test
    @DisplayName("toolConnectionVulnerabilitiesUpdatedAt: non-Fleet connection returns null without calling the service")
    void toolConnectionVulnerabilitiesUpdatedAt_meshcentral_nullWithoutServiceCall() {
        ToolConnection connection = new ToolConnection();
        connection.setToolType(ToolType.MESHCENTRAL);
        when(dfe.getSource()).thenReturn(connection);

        Instant result = fetcher.toolConnectionVulnerabilitiesUpdatedAt(dfe);

        assertThat(result).isNull();
        verify(fleetVulnerabilityStatusService, never()).getLastCompletedVulnerabilityRunAt();
    }
}
