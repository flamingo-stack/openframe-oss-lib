package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.InstalledOsUpdateDevice;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOrganizationDeviceCount;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsUpdateHistoryServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final List<String> EVERY_DEVICE = null;
    private static final Instant NEWEST = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant OLDER = Instant.parse("2026-11-18T07:02:11Z");
    private static final Instant OLDEST = Instant.parse("2026-10-15T03:12:44Z");

    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private DeviceService deviceService;
    @Spy private CursorPageAssembler cursorPageAssembler = new CursorPageAssembler();
    @Mock private DeviceOsResponseMapper deviceOsResponseMapper;
    @Mock private OsUpdateResponseMapper osUpdateResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;

    private DeviceOsUpdateHistoryEntry newestEntry;
    private DeviceOsUpdateHistoryEntry olderEntry;
    private DeviceOsUpdateHistoryEntry oldestEntry;
    private DeviceOsUpdateHistoryEntryResponse newestResponse;
    private DeviceOsUpdateHistoryEntryResponse olderResponse;

    @BeforeEach
    void setUp() {
        newestEntry = DeviceOsUpdateHistoryEntry.builder().id("id-3").identifier("kb-3").installedAt(NEWEST).build();
        olderEntry = DeviceOsUpdateHistoryEntry.builder().id("id-2").identifier("kb-2").installedAt(OLDER).build();
        oldestEntry = DeviceOsUpdateHistoryEntry.builder().id("id-1").identifier("kb-1").installedAt(OLDEST).build();
        newestResponse = DeviceOsUpdateHistoryEntryResponse.builder()
                .identifier("kb-3").cursor(CursorCodec.encode("raw-3")).build();
        olderResponse = DeviceOsUpdateHistoryEntryResponse.builder()
                .identifier("kb-2").cursor(CursorCodec.encode("raw-2")).build();
    }

    @Test
    void listUpdateHistory_moreEntriesThanThePage_pageOfTheLimitWithANextPageAndItsCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(false)
                .startCursor(CursorCodec.encode("raw-3"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3))
                .thenReturn(List.of(newestEntry, olderEntry, oldestEntry));
        stubHistoryResponses();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page =
                deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        assertThat(page.getItems()).containsExactly(newestResponse, olderResponse);
        assertThat(page.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listUpdateHistory_lastPageAfterACursor_noNextPageAndAPreviousOne() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("raw-4").build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, "raw-4", 3))
                .thenReturn(List.of(newestEntry, olderEntry));
        stubHistoryResponses();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page =
                deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        assertThat(page.getItems()).containsExactly(newestResponse, olderResponse);
        assertThat(page.getPageInfo())
                .extracting(PageInfo::isHasNextPage, PageInfo::isHasPreviousPage)
                .containsExactly(false, true);
    }

    @ParameterizedTest
    @CsvSource({
            ",    21",
            "1,   2",
            "100, 101",
            "0,   2",
            "-5,  2",
            "101, 101",
            "500, 101"
    })
    void listUpdateHistory_pageSize_twentyByDefaultAndKeptBetweenOneAndAHundred(Integer first, int expectedFetch) {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(first).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, expectedFetch))
                .thenReturn(List.of());

        // execution
        deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        verify(deviceOsUpdateHistoryRepository).findPage(TENANT_ID, MACHINE_ID, null, expectedFetch);
    }

    @Test
    void listUpdateHistory_unknownDevice_throwsDeviceNotFound() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().build();
        doThrow(new DeviceNotFoundException("Device not found: " + MACHINE_ID))
                .when(deviceService).verifyExists(MACHINE_ID);

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> deviceOsUpdateHistoryService.listUpdateHistory(MACHINE_ID, pagination));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void countInstalledDevicesByIdentifier_everyDeviceOrAScope_countOfTheMatchingQuery() {
        // setup
        List<OsUpdateDeviceCount> ofAll = List.of(new OsUpdateDeviceCount(IDENTIFIER, 3));
        List<OsUpdateDeviceCount> ofScope = List.of(new OsUpdateDeviceCount(IDENTIFIER, 1));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifier(List.of(IDENTIFIER), TENANT_ID))
                .thenReturn(ofAll);
        when(deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierOnMachines(
                List.of(IDENTIFIER), List.of(MACHINE_ID), TENANT_ID)).thenReturn(ofScope);

        // execution
        List<OsUpdateDeviceCount> everyDevice =
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(List.of(IDENTIFIER), EVERY_DEVICE);
        List<OsUpdateDeviceCount> scoped =
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(List.of(IDENTIFIER), List.of(MACHINE_ID));

        // verifications
        assertThat(everyDevice).isSameAs(ofAll);
        assertThat(scoped).isSameAs(ofScope);
    }

    @Test
    void countInstalledDevicesByIdentifierAndOrganization_everyUpdateOfEveryDevice_groupedReadOfTheTenant() {
        // setup
        List<OsUpdateOrganizationDeviceCount> deviceCounts =
                List.of(new OsUpdateOrganizationDeviceCount(IDENTIFIER, "org-1", 3));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.countInstalledDevicesByIdentifierAndOrganization(
                TENANT_ID, null, EVERY_DEVICE)).thenReturn(deviceCounts);

        // execution
        List<OsUpdateOrganizationDeviceCount> found =
                deviceOsUpdateHistoryService.countInstalledDevicesByIdentifierAndOrganization(null, EVERY_DEVICE);

        // verifications
        assertThat(found).isSameAs(deviceCounts);
    }

    @Test
    void listInstalledIdentifiers_machines_identifiersTheyInstalled() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.findInstalledIdentifiersOnMachines(List.of(MACHINE_ID), TENANT_ID))
                .thenReturn(List.of(IDENTIFIER));

        // execution
        List<String> identifiers = deviceOsUpdateHistoryService.listInstalledIdentifiers(List.of(MACHINE_ID));

        // verifications
        assertThat(identifiers).containsExactly(IDENTIFIER);
    }

    @Test
    void listOsUpdateDevices_pageOfInstalledDevices_eachWithItsCursor() {
        // setup
        InstalledOsUpdateDevice installedDevice = new InstalledOsUpdateDevice(MACHINE_ID, NEWEST);
        OsUpdateDeviceResponse response = OsUpdateDeviceResponse.builder().machineId(MACHINE_ID).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsUpdateHistoryRepository.findInstalledDevicePage(TENANT_ID, IDENTIFIER, EVERY_DEVICE, null, 6))
                .thenReturn(List.of(installedDevice));
        when(deviceOsUpdateHistoryRepository.encodeInstalledDeviceCursor(installedDevice)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toInstalledDeviceResponse(installedDevice, CursorCodec.encode("raw-1")))
                .thenReturn(response);

        // execution
        List<OsUpdateDeviceResponse> found =
                deviceOsUpdateHistoryService.listOsUpdateDevices(IDENTIFIER, EVERY_DEVICE, null, 6);

        // verifications
        assertThat(found).containsExactly(response);
    }

    private void stubHistoryResponses() {
        when(deviceOsUpdateHistoryRepository.encodeCursor(newestEntry)).thenReturn("raw-3");
        when(deviceOsUpdateHistoryRepository.encodeCursor(olderEntry)).thenReturn("raw-2");
        when(deviceOsResponseMapper.toResponse(newestEntry, CursorCodec.encode("raw-3"))).thenReturn(newestResponse);
        when(deviceOsResponseMapper.toResponse(olderEntry, CursorCodec.encode("raw-2"))).thenReturn(olderResponse);
    }
}
