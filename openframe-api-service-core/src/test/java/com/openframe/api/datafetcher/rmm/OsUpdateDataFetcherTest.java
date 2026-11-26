package com.openframe.api.datafetcher.rmm;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dataloader.OsUpdateDeviceCountsKey;
import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateFilterInput;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdateGraphQLMapper;
import com.openframe.api.service.rmm.osupdate.OsUpdateDeviceService;
import com.openframe.api.service.rmm.osupdate.OsUpdateService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import graphql.execution.DataFetcherResult;
import org.dataloader.DataLoader;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateDataFetcherTest {

    private static final List<String> ORGANIZATION_IDS = List.of("org-1");
    private static final OsUpdateDeviceScope ORGANIZATION_DEVICES =
            new OsUpdateDeviceScope(List.of("machine-1"));

    private static final String OS_UPDATE_ID = "6aff19c07ce86a3f0386ff82";
    private static final String MACHINE_ID = "machine-1";
    private static final String AFTER = "after-cursor";
    private static final String NOT_FOUND = "OS update not found: " + OS_UPDATE_ID;

    @Mock private OsUpdateService osUpdateService;
    @Mock private OsUpdateDeviceService osUpdateDeviceService;
    @Mock private OsUpdateGraphQLMapper osUpdateGraphQLMapper;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Mock private DataLoader<OsUpdateDeviceCountsKey, OsUpdateDeviceCounts> deviceCountsDataLoader;
    @Mock private DataLoader<String, Machine> machineDataLoader;

    @InjectMocks private OsUpdateDataFetcher dataFetcher;

    private CursorPaginationCriteria pagination;
    private OsUpdateResponse osUpdate;

    @BeforeEach
    void setUp() {
        pagination = CursorPaginationCriteria.builder().limit(5).cursor("raw-cursor").build();
        osUpdate = OsUpdateResponse.builder().id(OS_UPDATE_ID).build();
    }

    @Test
    void osUpdates_filterAndPage_connectionOfThePageTheServiceReturns() {
        // setup
        OsUpdateFilterInput filterInput = OsUpdateFilterInput.builder().platform(OsPlatform.WINDOWS).build();
        OsUpdateFilter osUpdateFilter = OsUpdateFilter.builder().platform(OsPlatform.WINDOWS).build();
        GenericQueryResult<OsUpdateResponse> osUpdates =
                GenericQueryResult.<OsUpdateResponse>builder().items(List.of(osUpdate)).build();
        GenericConnection<GenericEdge<OsUpdateResponse>> connection =
                GenericConnection.<GenericEdge<OsUpdateResponse>>builder().edges(List.of()).build();
        when(osUpdateGraphQLMapper.toOsUpdateFilter(filterInput)).thenReturn(osUpdateFilter);
        when(osUpdateGraphQLMapper.toCursorPaginationCriteria(5, AFTER)).thenReturn(pagination);
        when(osUpdateGraphQLMapper.toOrganizationIds(filterInput)).thenReturn(ORGANIZATION_IDS);
        when(osUpdateService.findDeviceScope(ORGANIZATION_IDS)).thenReturn(ORGANIZATION_DEVICES);
        when(osUpdateService.listOsUpdates(osUpdateFilter, ORGANIZATION_DEVICES, pagination)).thenReturn(osUpdates);
        when(osUpdateGraphQLMapper.toOsUpdateConnection(osUpdates)).thenReturn(connection);

        // execution
        DataFetcherResult<GenericConnection<GenericEdge<OsUpdateResponse>>> found =
                dataFetcher.osUpdates(filterInput, 5, AFTER);

        // verifications
        assertThat(found.getData()).isSameAs(connection);
        assertThat(found.getLocalContext()).isSameAs(ORGANIZATION_DEVICES);
        verify(osUpdateService).findDeviceScope(ORGANIZATION_IDS);
    }

    @Test
    void osUpdate_updateOfTheTenant_updateOfTheService() {
        // setup
        when(osUpdateService.findOsUpdate(OS_UPDATE_ID)).thenReturn(Optional.of(osUpdate));

        // execution
        OsUpdateResponse found = dataFetcher.osUpdate(OS_UPDATE_ID);

        // verifications
        assertThat(found).isSameAs(osUpdate);
    }

    @Test
    void osUpdate_noSuchUpdate_null() {
        // setup
        when(osUpdateService.findOsUpdate(OS_UPDATE_ID)).thenReturn(Optional.empty());

        // execution
        OsUpdateResponse found = dataFetcher.osUpdate(OS_UPDATE_ID);

        // verifications
        assertThat(found).isNull();
    }

    @Test
    void osUpdateDevices_statusAndPage_connectionOfThePageTheServiceReturns() {
        // setup
        GenericQueryResult<OsUpdateDeviceResponse> devices =
                GenericQueryResult.<OsUpdateDeviceResponse>builder().items(List.of()).build();
        GenericConnection<GenericEdge<OsUpdateDeviceResponse>> connection =
                GenericConnection.<GenericEdge<OsUpdateDeviceResponse>>builder().edges(List.of()).build();
        when(osUpdateGraphQLMapper.toCursorPaginationCriteria(5, AFTER)).thenReturn(pagination);
        when(osUpdateDeviceService.listDevices(OS_UPDATE_ID, OsUpdateDeviceStatus.INSTALLED, ORGANIZATION_IDS, pagination))
                .thenReturn(devices);
        when(osUpdateGraphQLMapper.toDeviceConnection(devices)).thenReturn(connection);

        // execution
        GenericConnection<GenericEdge<OsUpdateDeviceResponse>> found =
                dataFetcher.osUpdateDevices(OS_UPDATE_ID, OsUpdateDeviceStatus.INSTALLED, ORGANIZATION_IDS, 5, AFTER);

        // verifications
        assertThat(found).isSameAs(connection);
    }

    @Test
    void osUpdateDevices_noSuchUpdate_osUpdateNotFoundPassedOn() {
        // setup
        when(osUpdateGraphQLMapper.toCursorPaginationCriteria(null, null)).thenReturn(pagination);
        when(osUpdateDeviceService.listDevices(OS_UPDATE_ID, OsUpdateDeviceStatus.PENDING, null, pagination))
                .thenThrow(new OsUpdateNotFoundException(NOT_FOUND));

        // execution
        OsUpdateNotFoundException ex = assertThrows(OsUpdateNotFoundException.class,
                () -> dataFetcher.osUpdateDevices(OS_UPDATE_ID, OsUpdateDeviceStatus.PENDING, null, null, null));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(NOT_FOUND);
    }

    @Test
    void pendingDeviceCount_update_pendingCountOfTheBatchedCounts() {
        // setup
        stubDeviceCounts();

        // execution
        CompletableFuture<Integer> pendingDeviceCount = dataFetcher.pendingDeviceCount(dfe);

        // verifications
        assertThat(pendingDeviceCount).isCompletedWithValue(7);
        verifyNoInteractions(osUpdateService);
    }

    @Test
    void installedDeviceCount_update_installedCountOfTheBatchedCounts() {
        // setup
        stubDeviceCounts();

        // execution
        CompletableFuture<Integer> installedDeviceCount = dataFetcher.installedDeviceCount(dfe);

        // verifications
        assertThat(installedDeviceCount).isCompletedWithValue(3);
        verifyNoInteractions(osUpdateService);
    }

    @Test
    void pendingDeviceCount_updateListedForOrganizations_countsLoadedForTheirDevices() {
        // setup
        OsUpdateDeviceCounts deviceCounts = OsUpdateDeviceCounts.builder().pendingDeviceCount(2).build();
        OsUpdateDeviceCountsKey osUpdateDeviceCountsKey =
                OsUpdateDeviceCountsKey.builder().osUpdateId(OS_UPDATE_ID).osUpdateDeviceScope(ORGANIZATION_DEVICES).build();
        doReturn(osUpdate).when(dfe).getSource();
        doReturn(ORGANIZATION_DEVICES).when(dfe).getLocalContext();
        doReturn(deviceCountsDataLoader).when(dfe).getDataLoader("osUpdateDeviceCountsDataLoader");
        when(deviceCountsDataLoader.load(osUpdateDeviceCountsKey))
                .thenReturn(CompletableFuture.completedFuture(deviceCounts));

        // execution
        CompletableFuture<Integer> pendingDeviceCount = dataFetcher.pendingDeviceCount(dfe);

        // verifications
        assertThat(pendingDeviceCount).isCompletedWithValue(2);
    }

    @Test
    void machine_deviceOfAnUpdate_machineOfTheMachineLoaderByItsMachineId() {
        // setup
        OsUpdateDeviceResponse device = OsUpdateDeviceResponse.builder().machineId(MACHINE_ID).build();
        Machine machine = new Machine();
        doReturn(device).when(dfe).getSource();
        doReturn(machineDataLoader).when(dfe).getDataLoader("machineDataLoader");
        when(machineDataLoader.load(MACHINE_ID)).thenReturn(CompletableFuture.completedFuture(machine));

        // execution
        CompletableFuture<Machine> found = dataFetcher.machine(dfe);

        // verifications
        assertThat(found).isCompletedWithValue(machine);
    }

    private void stubDeviceCounts() {
        OsUpdateDeviceCounts deviceCounts =
                OsUpdateDeviceCounts.builder().pendingDeviceCount(7).installedDeviceCount(3).build();
        doReturn(osUpdate).when(dfe).getSource();
        doReturn(deviceCountsDataLoader).when(dfe).getDataLoader("osUpdateDeviceCountsDataLoader");
        OsUpdateDeviceCountsKey osUpdateDeviceCountsKey =
                OsUpdateDeviceCountsKey.builder().osUpdateId(OS_UPDATE_ID)
                        .osUpdateDeviceScope(OsUpdateDeviceScope.EVERY_DEVICE).build();
        when(deviceCountsDataLoader.load(osUpdateDeviceCountsKey))
                .thenReturn(CompletableFuture.completedFuture(deviceCounts));
    }
}
