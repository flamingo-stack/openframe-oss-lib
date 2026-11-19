package com.openframe.api.datafetcher.rmm;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.GraphQLOsUpdateMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
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
class OsUpdateDataFetcherTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String AFTER = "after-cursor";

    @Mock private OsUpdateService osUpdateService;
    @Mock private GraphQLOsUpdateMapper graphQLOsUpdateMapper;

    @InjectMocks private OsUpdateDataFetcher dataFetcher;

    @Test
    void deviceOsUpdates_knownDevice_pendingUpdatesOfTheService() {
        // setup
        DeviceOsUpdateResponse update = DeviceOsUpdateResponse.builder().updateKey("k-1").build();
        when(osUpdateService.listPendingForDevice(MACHINE_ID)).thenReturn(List.of(update));

        // execution
        List<DeviceOsUpdateResponse> pending = dataFetcher.deviceOsUpdates(MACHINE_ID);

        // verifications
        assertThat(pending).containsExactly(update);
    }

    @Test
    void deviceOsUpdates_unknownDevice_deviceNotFoundPassedOn() {
        // setup
        when(osUpdateService.listPendingForDevice(MACHINE_ID))
                .thenThrow(new DeviceNotFoundException("Device not found: " + MACHINE_ID));

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> dataFetcher.deviceOsUpdates(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
    }

    @Test
    void deviceOsUpdateHistory_firstAndAfter_pageOfTheServiceAsAConnection() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(5).cursor("raw").build();
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page =
                GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder().items(List.of()).build();
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> connection =
                GenericConnection.<GenericEdge<DeviceOsUpdateHistoryEntryResponse>>builder().edges(List.of()).build();
        when(graphQLOsUpdateMapper.toCursorPaginationCriteria(5, AFTER)).thenReturn(pagination);
        when(osUpdateService.listHistoryForDevice(MACHINE_ID, pagination)).thenReturn(page);
        when(graphQLOsUpdateMapper.toConnection(page)).thenReturn(connection);

        // execution
        GenericConnection<GenericEdge<DeviceOsUpdateHistoryEntryResponse>> history =
                dataFetcher.deviceOsUpdateHistory(MACHINE_ID, 5, AFTER);

        // verifications
        assertThat(history).isSameAs(connection);
    }
}
