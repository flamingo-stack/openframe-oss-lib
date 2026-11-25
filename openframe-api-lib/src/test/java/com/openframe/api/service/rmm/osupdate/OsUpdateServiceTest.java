package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceCounts;
import com.openframe.api.dto.rmm.osupdate.OsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateFilter;
import com.openframe.data.repository.rmm.osupdate.OsUpdateIdentifiersOfPlatform;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String WINDOWS_ID = "id-windows";
    private static final String OTHER_WINDOWS_ID = "id-windows-2";
    private static final String MAC_ID = "id-mac";
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final String OTHER_WINDOWS_IDENTIFIER = "0d1e2f3a-5555-4666-8777-112233445566:1";
    private static final String MAC_IDENTIFIER = "Safari-18.2";
    private static final List<String> EVERY_ORGANIZATION = List.of();
    private static final List<String> EVERY_DEVICE = null;
    private static final List<String> ORGANIZATIONS = List.of("org-1");
    private static final List<String> ORGANIZATION_MACHINE_IDS = List.of("machine-1", "machine-2");
    private static final OsUpdateFilter FILTER = OsUpdateFilter.builder().platform(OsPlatform.WINDOWS).build();

    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    @Mock private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    @Mock private DeviceService deviceService;
    @Spy private CursorPageAssembler cursorPageAssembler = new CursorPageAssembler();
    @Mock private OsUpdateResponseMapper osUpdateResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private OsUpdateService osUpdateService;

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
        GenericQueryResult<OsUpdateResponse> osUpdates =
                osUpdateService.listOsUpdates(FILTER, EVERY_ORGANIZATION, pagination);

        // verifications
        assertThat(osUpdates.getItems()).containsExactly(windowsResponse, otherWindowsResponse);
        assertThat(osUpdates.getPageInfo()).isEqualTo(expectedPageInfo);
        verifyNoInteractions(deviceService);
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
        osUpdateService.listOsUpdates(FILTER, EVERY_ORGANIZATION, pagination);

        // verifications
        verify(osUpdateRepository).findPage(TENANT_ID, FILTER, null, expectedFetch);
    }

    @Test
    void listOsUpdates_organizations_onlyTheUpdatesPendingOrInstalledOnTheirDevices() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);
        when(deviceOsPendingUpdateService.listIdentifiersByPlatform(ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateIdentifiersOfPlatform(OsPlatform.MACOS, List.of(MAC_IDENTIFIER))));
        when(deviceOsUpdateHistoryService.listInstalledIdentifiers(ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(WINDOWS_IDENTIFIER));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, Set.of(WINDOWS_IDENTIFIER))).thenReturn(List.of(windowsUpdate));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.MACOS, Set.of(MAC_IDENTIFIER))).thenReturn(List.of(macUpdate));
        OsUpdateFilter expectedFilter = FILTER.toBuilder().osUpdateIds(List.of(WINDOWS_ID, MAC_ID)).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = osUpdateService.listOsUpdates(FILTER, ORGANIZATIONS, pagination);

        // verifications
        assertThat(osUpdates.getItems()).isEmpty();
        verify(osUpdateRepository).findPage(TENANT_ID, expectedFilter, null, 3);
    }

    @Test
    void listOsUpdates_organizationsWithoutDevices_filterOfNoUpdate() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(List.of());
        when(deviceOsPendingUpdateService.listIdentifiersByPlatform(List.of())).thenReturn(List.of());
        when(deviceOsUpdateHistoryService.listInstalledIdentifiers(List.of())).thenReturn(List.of());
        OsUpdateFilter expectedFilter = FILTER.toBuilder().osUpdateIds(List.of()).build();
        when(osUpdateRepository.findPage(TENANT_ID, expectedFilter, null, 3)).thenReturn(List.of());

        // execution
        GenericQueryResult<OsUpdateResponse> osUpdates = osUpdateService.listOsUpdates(FILTER, ORGANIZATIONS, pagination);

        // verifications
        assertThat(osUpdates.getItems()).isEmpty();
    }

    @Test
    void findOsUpdate_updateOfTheTenant_itsResponse() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.of(windowsUpdate));
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);

        // execution
        Optional<OsUpdateResponse> found = osUpdateService.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).containsSame(windowsResponse);
    }

    @Test
    void findOsUpdate_noSuchUpdateInTheTenant_empty() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        Optional<OsUpdateResponse> found = osUpdateService.findOsUpdate(WINDOWS_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(osUpdateResponseMapper);
    }

    @Test
    void getOsUpdate_noSuchUpdateInTheTenant_throwsOsUpdateNotFound() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndId(TENANT_ID, WINDOWS_ID)).thenReturn(Optional.empty());

        // execution
        OsUpdateNotFoundException ex =
                assertThrows(OsUpdateNotFoundException.class, () -> osUpdateService.getOsUpdate(WINDOWS_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS update not found: " + WINDOWS_ID);
    }

    @Test
    void countDevices_windowsUpdates_pendingAndInstalledPerUpdate() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, OTHER_WINDOWS_ID);
        List<String> identifiers = List.of(WINDOWS_IDENTIFIER, OTHER_WINDOWS_IDENTIFIER);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds))
                .thenReturn(List.of(windowsUpdate, otherWindowsUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(OsPlatform.WINDOWS, identifiers, EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 7)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(identifiers, EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 3),
                        new OsUpdateDeviceCount(OTHER_WINDOWS_IDENTIFIER, 5)));

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, EVERY_ORGANIZATION);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(7).installedDeviceCount(3).build())
                .containsEntry(OTHER_WINDOWS_ID, OsUpdateDeviceCounts.builder().installedDeviceCount(5).build());
        verifyNoInteractions(deviceService);
    }

    @Test
    void countDevices_macUpdateNextToAWindowsOne_eachCountedWithinItsPlatformAndNoMacHistoryRead() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID, MAC_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of(windowsUpdate, macUpdate));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 1)));
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(OsPlatform.MACOS, List.of(MAC_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of(new OsUpdateDeviceCount(MAC_IDENTIFIER, 4)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(List.of(WINDOWS_IDENTIFIER), EVERY_DEVICE))
                .thenReturn(List.of());

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, EVERY_ORGANIZATION);

        // verifications
        assertThat(deviceCounts)
                .hasSize(2)
                .containsEntry(WINDOWS_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(1).build())
                .containsEntry(MAC_ID, OsUpdateDeviceCounts.builder().pendingDeviceCount(4).build());
    }

    @Test
    void countDevices_organizations_countedOnTheirDevicesOnly() {
        // setup
        List<String> osUpdateIds = List.of(WINDOWS_ID);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of(windowsUpdate));
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);
        when(deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(WINDOWS_IDENTIFIER), ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 1)));
        when(deviceOsUpdateHistoryService.countInstalledDevicesByIdentifier(
                List.of(WINDOWS_IDENTIFIER), ORGANIZATION_MACHINE_IDS))
                .thenReturn(List.of(new OsUpdateDeviceCount(WINDOWS_IDENTIFIER, 2)));

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, ORGANIZATIONS);

        // verifications
        assertThat(deviceCounts).containsExactly(Map.entry(WINDOWS_ID,
                OsUpdateDeviceCounts.builder().pendingDeviceCount(1).installedDeviceCount(2).build()));
    }

    @Test
    void countDevices_noneOfTheIdsIsAnUpdateOfTheTenant_emptyAndNothingCounted() {
        // setup
        List<String> osUpdateIds = List.of("unknown");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(osUpdateRepository.findByTenantIdAndIdIn(TENANT_ID, osUpdateIds)).thenReturn(List.of());

        // execution
        Map<String, OsUpdateDeviceCounts> deviceCounts = osUpdateService.countDevices(osUpdateIds, ORGANIZATIONS);

        // verifications
        assertThat(deviceCounts).isEmpty();
        verifyNoInteractions(deviceService, deviceOsPendingUpdateService, deviceOsUpdateHistoryService);
    }

    private void stubOsUpdateResponses() {
        when(osUpdateRepository.encodeCursor(windowsUpdate)).thenReturn("raw-1");
        when(osUpdateRepository.encodeCursor(otherWindowsUpdate)).thenReturn("raw-2");
        when(osUpdateResponseMapper.toResponse(windowsUpdate, CursorCodec.encode("raw-1"))).thenReturn(windowsResponse);
        when(osUpdateResponseMapper.toResponse(otherWindowsUpdate, CursorCodec.encode("raw-2")))
                .thenReturn(otherWindowsResponse);
    }

    private static OsUpdate osUpdate(String id, OsPlatform platform, String identifier) {
        return OsUpdate.builder().id(id).tenantId(TENANT_ID).platform(platform).identifier(identifier).build();
    }
}
