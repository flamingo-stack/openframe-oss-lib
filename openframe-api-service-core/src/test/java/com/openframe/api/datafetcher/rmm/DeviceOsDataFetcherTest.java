package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.DeviceOsPendingUpdateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsStateService;
import com.openframe.api.service.rmm.osupdate.DeviceOsUpdateHistoryService;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsDataFetcherTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String AFTER = "after-cursor";
    private static final String NOT_FOUND = "Device not found: " + MACHINE_ID;

    @Mock private DeviceOsStateService deviceOsStateService;
    @Mock private DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    @Mock private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    @Mock private DeviceOsGraphQLMapper deviceOsGraphQLMapper;

    @InjectMocks private DeviceOsDataFetcher dataFetcher;

    @Test
    void deviceOsState_deviceThatReported_stateOfTheService() {
        // setup
        DeviceOsStateResponse state = DeviceOsStateResponse.builder().osVersion("11 24H2").build();
        when(deviceOsStateService.findOsState(MACHINE_ID)).thenReturn(state);

        // execution
        DeviceOsStateResponse found = dataFetcher.deviceOsState(MACHINE_ID);

        // verifications
        assertThat(found).isSameAs(state);
    }

    @Test
    void deviceOsState_deviceThatNeverReported_null() {
        // setup
        when(deviceOsStateService.findOsState(MACHINE_ID)).thenReturn(null);

        // execution
        DeviceOsStateResponse found = dataFetcher.deviceOsState(MACHINE_ID);

        // verifications
        assertThat(found).isNull();
    }

    @Test
    void deviceOsState_unknownDevice_deviceNotFoundPassedOn() {
        // setup
        when(deviceOsStateService.findOsState(MACHINE_ID)).thenThrow(new DeviceNotFoundException(NOT_FOUND));

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> dataFetcher.deviceOsState(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(NOT_FOUND);
    }

    @Test
    void deviceOsPendingUpdates_knownDevice_pendingUpdatesOfTheService() {
        // setup
        List<DeviceOsPendingUpdateResponse> pendingUpdates =
                List.of(DeviceOsPendingUpdateResponse.builder().identifier("kb-1").build());
        when(deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID)).thenReturn(pendingUpdates);

        // execution
        List<DeviceOsPendingUpdateResponse> found = dataFetcher.deviceOsPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).isSameAs(pendingUpdates);
    }

    @Test
    void deviceOsPendingUpdates_unknownDevice_deviceNotFoundPassedOn() {
        // setup
        when(deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID)).thenThrow(new DeviceNotFoundException(NOT_FOUND));

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> dataFetcher.deviceOsPendingUpdates(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(NOT_FOUND);
    }

    @Test
    void deviceOsUpdateHistory_firstAndAfter_pageOfTheServiceAsAConnection() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(5).cursor("raw").build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> updateHistory =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder().items(List.of()).build();
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection =
                GenericConnection.<GenericEdge<DeviceOsUpdateHistoryEntryResponse>>builder().edges(List.of()).build();
        when(deviceOsGraphQLMapper.toCursorPaginationCriteria(5, AFTER)).thenReturn(pagination);
        when(deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination)).thenReturn(updateHistory);
        when(deviceOsGraphQLMapper.toConnection(updateHistory)).thenReturn(connection);

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> found =
                dataFetcher.deviceOsUpdateHistory(MACHINE_ID, 5, AFTER);

        // verifications
        assertThat(found).isSameAs(connection);
    }

    @Test
    void deviceOsUpdateHistory_unknownDevice_deviceNotFoundPassedOn() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().build();
        when(deviceOsGraphQLMapper.toCursorPaginationCriteria(null, null)).thenReturn(pagination);
        when(deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination))
                .thenThrow(new DeviceNotFoundException(NOT_FOUND));

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> dataFetcher.deviceOsUpdateHistory(MACHINE_ID, null, null));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(NOT_FOUND);
    }
}
