package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateQueryServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String WINDOWS_ID = "id-windows";
    private static final String OTHER_WINDOWS_ID = "id-windows-2";
    private static final String MAC_ID = "id-mac";
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String OTHER_WINDOWS_IDENTIFIER = "0d1e2f3a-5555-4666-8777-112233445566:1";
    private static final String MAC_IDENTIFIER = "Safari-18.2";
    private static final List<String> NOT_MANAGEABLE_MACHINE_IDS = List.of("machine-9");
    private static final Instant NEWEST = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant OLDER = Instant.parse("2026-11-18T07:02:11Z");
    private static final OsUpdateFilter FILTER = OsUpdateFilter.builder().platform(OsPlatform.WINDOWS).build();

    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private OsUpdateResponseMapper osUpdateResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private OsUpdateQueryService service;

    private OsUpdate windowsUpdate;
    private OsUpdate otherWindowsUpdate;
    private OsUpdate macUpdate;
    private OsUpdateResponse windowsResponse;
    private OsUpdateResponse otherWindowsResponse;

    @BeforeEach
    void setUp() {
        windowsUpdate = osUpdate(WINDOWS_ID, OsPlatform.WINDOWS, WINDOWS_IDENTIFIER);
        otherWindowsUpdate = osUpdate(OTHER_WINDOWS_ID, OsPlatform.WINDOWS, OTHER_WINDOWS_IDENTIFIER);
        macUpdate = osUpdate(MAC_ID, OsPlatform.MACOS, MAC_IDENTIFIER);
        windowsResponse = OsUpdateResponse.builder().id(WINDOWS_ID).cursor(CursorCodec.encode("raw-1")).build();
        otherWindowsResponse = OsUpdateResponse.builder().id(OTHER_WINDOWS_ID).cursor(CursorCodec.encode("raw-2")).build();
    }

    @Test
    void listOsUpdates_moreUpdatesThanThePage_pageOfTheLimitWithANextPageAndItsCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, null, 3))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate, macUpdate));
        stubOsUpdateResponses();
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(false)
                .startCursor(CursorCodec.encode("raw-1"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = service.listOsUpdates(FILTER, pagination);

        // verifications
        assertThat(osUpdates.getItems()).containsExactly(windowsResponse, otherWindowsResponse);
        assertThat(osUpdates.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listOsUpdates_lastPageAfterACursor_noNextPageAndAPreviousOne() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("raw-0").build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, "raw-0", 3))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        stubOsUpdateResponses();

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = service.listOsUpdates(FILTER, pagination);

        // verifications
        assertThat(osUpdates.getItems()).containsExactly(windowsResponse, otherWindowsResponse);
        assertThat(osUpdates.getPageInfo())
                .extracting(PageInfo::isHasNextPage, PageInfo::isHasPreviousPage)
                .containsExactly(false, true);
    }

    @Test
    void listOsUpdates_noUpdates_emptyPageWithoutCursors() {
        // setup
        CursorPaginationCriteria pagination = new CursorPaginationCriteria();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, null, 21)).thenReturn(List.of());
        PageInfo expectedPageInfo = PageInfo.builder().build();

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = service.listOsUpdates(FILTER, pagination);

        // verifications
        assertThat(osUpdates.getItems()).isEmpty();
        assertThat(osUpdates.getPageInfo()).isEqualTo(expectedPageInfo);
        verifyNoInteractions(osUpdateResponseMapper);
    }

    @ParameterizedTest
    @CsvSource({
            ",    21",
            "0,   2",
            "1,   2",
            "100, 101",
            "500, 101"
    })
    void listOsUpdates_pageSize_twentyByDefaultAndKeptBetweenOneAndAHundred(Integer first, int expectedFetch) {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(first).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findPage(TENANT_ID, FILTER, null, expectedFetch)).thenReturn(List.of());

        // execution
        service.listOsUpdates(FILTER, pagination);

        // verifications
        verify(osUpdateRepository).findPage(TENANT_ID, FILTER, null, expectedFetch);
    }

    @Test
    void findOsUpdate_updateOfTheTenant_itsResponse() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);

        // execution
        Optional<OsUpdateResponse> found = service.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).containsSame(windowsResponse);
    }

    @Test
    void findOsUpdate_noSuchUpdateInTheTenant_empty() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        Optional<OsUpdateResponse> found = service.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(osUpdateResponseMapper);
    }

    @Test
    void countDevices_windowsUpdates_pendingWithoutNotManageableDevicesAndInstalledFromTheHistory() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, OTHER_WINDOWS_ID);
        List<String> identifiers = List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        when(deviceOsStateRepository.findByTenantIdAndManageabilityState(
                TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE)).thenReturn(notManageableStates());
        when(deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, identifiers, NOT_MANAGEABLE_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 7)));
        when(deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(TENANT_ID, identifiers))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 3),
                        new OsUpdateDeviceCount(OTHER_WINDOWS_IDENTIFIER, 5)));
        OsUpdateDeviceCounts expectedWindows =
                OsUpdateDeviceCounts.builder().pendingDeviceCount(7).installedDeviceCount(3).build();
        OsUpdateDeviceCounts expectedOtherWindows =
                OsUpdateDeviceCounts.builder().pendingDeviceCount(0).installedDeviceCount(5).build();

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = service.countDevices(osUpdateIds);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, expectedWindows)
                .containsEntry(OTHER_WINDOWS_ID, expectedOtherWindows);
    }

    @Test
    void countDevices_macUpdateNextToAWindowsOne_eachCountedWithinItsPlatformAndTheMacHistoryNotRead() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, MAC_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds))
                .thenReturn(List.of(windowsUpdate, macUpdate));
        when(deviceOsStateRepository.findByTenantIdAndManageabilityState(
                TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE)).thenReturn(notManageableStates());
        when(deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), NOT_MANAGEABLE_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 1)));
        when(deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.MACOS, List.of(MAC_IDENTIFIER), NOT_MANAGEABLE_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(MAC_IDENTIFIER, 4)));
        when(deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(TENANT_ID, List.of(WINDOWS_IDENTIFIER)))
                .thenReturn(List.of());
        OsUpdateDeviceCounts expectedWindows = OsUpdateDeviceCounts.builder().pendingDeviceCount(1).build();
        OsUpdateDeviceCounts expectedMac = OsUpdateDeviceCounts.builder().pendingDeviceCount(4).build();

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = service.countDevices(osUpdateIds);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, expectedWindows)
                .containsEntry(MAC_ID, expectedMac);
    }

    @Test
    void countDevices_noneOfTheIdsIsAnUpdateOfTheTenant_emptyAndNothingCounted() {
        // setup
        List<String> osUpdateIds = List.of("unknown");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of());

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = service.countDevices(osUpdateIds);

        // verifications
        assertThat(deviceCounts).isEmpty();
        verifyNoInteractions(deviceOsStateRepository, deviceOsPendingUpdateRepository, deviceOsUpdateHistoryRepository);
    }

    @Test
    void listDevices_pending_pageOfThePendingRowsWithoutNotManageableDevices() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(1).cursor("raw-0").build();
        DeviceOsPendingUpdate newerPending = pendingUpdate("machine-2", NEWEST);
        DeviceOsPendingUpdate olderPending = pendingUpdate("machine-1", OLDER);
        OsUpdateDeviceResponse newerResponse = OsUpdateDeviceResponse.builder()
                .machineId("machine-2").status(OsUpdateDeviceStatus.PENDING).cursor(CursorCodec.encode("raw-2")).build();
        OsUpdateDeviceResponse olderResponse = OsUpdateDeviceResponse.builder()
                .machineId("machine-1").status(OsUpdateDeviceStatus.PENDING).cursor(CursorCodec.encode("raw-1")).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(deviceOsStateRepository.findByTenantIdAndManageabilityState(
                TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE)).thenReturn(notManageableStates());
        when(deviceOsPendingUpdateRepository.findDevicePage(
                TENANT_ID, OsPlatform.WINDOWS, WINDOWS_IDENTIFIER, NOT_MANAGEABLE_MACHINE_IDS, "raw-0", 2))
                .thenReturn(List.of(newerPending, olderPending));
        when(deviceOsPendingUpdateRepository.encodeDeviceCursor(newerPending)).thenReturn("raw-2");
        when(deviceOsPendingUpdateRepository.encodeDeviceCursor(olderPending)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toPendingDeviceResponse(newerPending, CursorCodec.encode("raw-2")))
                .thenReturn(newerResponse);
        when(osUpdateResponseMapper.toPendingDeviceResponse(olderPending, CursorCodec.encode("raw-1")))
                .thenReturn(olderResponse);
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(true)
                .startCursor(CursorCodec.encode("raw-2"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices =
                service.listDevices(WINDOWS_ID, OsUpdateDeviceStatus.PENDING, pagination);

        // verifications
        assertThat(devices.getItems()).containsExactly(newerResponse);
        assertThat(devices.getPageInfo()).isEqualTo(expectedPageInfo);
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void listDevices_installedOfAWindowsUpdate_pageOfTheHistoryAndThePendingRowsNotRead() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(5).build();
        InstalledOsUpdateDevice installedDevice = new InstalledOsUpdateDevice("machine-1", NEWEST);
        OsUpdateDeviceResponse installedResponse = OsUpdateDeviceResponse.builder()
                .machineId("machine-1").status(OsUpdateDeviceStatus.INSTALLED).cursor(CursorCodec.encode("raw-1")).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(deviceOsUpdateHistoryRepository.findInstalledDevicePage(TENANT_ID, WINDOWS_IDENTIFIER, null, 6))
                .thenReturn(List.of(installedDevice));
        when(deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(installedDevice)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toInstalledDeviceResponse(installedDevice, CursorCodec.encode("raw-1")))
                .thenReturn(installedResponse);

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices =
                service.listDevices(WINDOWS_ID, OsUpdateDeviceStatus.INSTALLED, pagination);

        // verifications
        assertThat(devices.getItems()).containsExactly(installedResponse);
        assertThat(devices.getPageInfo())
                .extracting(PageInfo::isHasNextPage, PageInfo::isHasPreviousPage)
                .containsExactly(false, false);
        verifyNoInteractions(deviceOsPendingUpdateRepository, deviceOsStateRepository);
    }

    @Test
    void listDevices_installedOfAMacUpdate_emptyAndTheHistoryNotRead() {
        // setup
        CursorPaginationCriteria pagination = new CursorPaginationCriteria();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, MAC_ID)).thenReturn(Optional.of(macUpdate));

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices =
                service.listDevices(MAC_ID, OsUpdateDeviceStatus.INSTALLED, pagination);

        // verifications
        assertThat(devices.getItems()).isEmpty();
        verifyNoInteractions(deviceOsUpdateHistoryRepository, deviceOsPendingUpdateRepository);
    }

    @ParameterizedTest
    @CsvSource({"PENDING", "INSTALLED"})
    void listDevices_noSuchUpdateInTheTenant_throwsOsUpdateNotFound(OsUpdateDeviceStatus status) {
        // setup
        CursorPaginationCriteria pagination = new CursorPaginationCriteria();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        OsUpdateNotFoundException ex = assertThrows(OsUpdateNotFoundException.class,
                () -> service.listDevices(WINDOWS_ID, status, pagination));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS update not found: " + WINDOWS_ID);
        verifyNoInteractions(deviceOsPendingUpdateRepository, deviceOsUpdateHistoryRepository);
    }

    private void stubOsUpdateResponses() {
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateRepository.encodeCursor(otherWindowsUpdate)).thenReturn("raw-2");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);
        when(osUpdateResponseMapper.toResponse(otherWindowsUpdate, CursorCodec.encode("raw-2")))
                .thenReturn(otherWindowsResponse);
    }

    private static OsUpdate osUpdate(String id, OsPlatform platform, String identifier) {
        return OsUpdate.builder()
                .id(id)
                .tenantId(TENANT_ID)
                .platform(platform)
                .identifier(identifier)
                .build();
    }

    private static DeviceOsPendingUpdate pendingUpdate(String machineId, Instant discoveredAt) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(machineId)
                .platform(OsPlatform.WINDOWS)
                .identifier(WINDOWS_IDENTIFIER)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static List<DeviceOsState> notManageableStates() {
        return NOT_MANAGEABLE_MACHINE_IDS.stream()
                .map(machineId -> DeviceOsState.builder().machineId(machineId).build())
                .toList();
    }
}
