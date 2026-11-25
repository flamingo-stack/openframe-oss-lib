package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsQueryServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant NEWEST = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant OLDER = Instant.parse("2026-11-18T07:02:11Z");
    private static final Instant OLDEST = Instant.parse("2026-10-15T03:12:44Z");

    @Mock private MachineRepository machineRepository;
    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private DeviceOsResponseMapper deviceOsResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private DeviceOsQueryService service;

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
    void findOsState_deviceThatReported_itsStateOfTheCallersTenant() {
        // setup
        DeviceOsState state = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).receivedAt(NEWEST).build();
        DeviceOsStateResponse response = DeviceOsStateResponse.builder().receivedAt(NEWEST).build();
        stubKnownDevice();
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.of(state));
        when(deviceOsResponseMapper.toResponse(state)).thenReturn(response);

        // execution
        DeviceOsStateResponse found = service.findOsState(MACHINE_ID);

        // verifications
        assertThat(found).isSameAs(response);
    }

    @Test
    void findOsState_deviceThatNeverReported_null() {
        // setup
        stubKnownDevice();
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceOsStateResponse found = service.findOsState(MACHINE_ID);

        // verifications
        assertThat(found).isNull();
        verifyNoInteractions(deviceOsResponseMapper);
    }

    @Test
    void findOsState_unknownDevice_throwsDeviceNotFound() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> service.findOsState(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsStateRepository);
    }

    @Test
    void listPendingUpdates_pendingUpdatesWithTheirOsUpdates_joinedInTheOrderOfTheRepository() {
        // setup
        DeviceOsPendingUpdate newerPending = pendingUpdate("kb-2", NEWEST);
        DeviceOsPendingUpdate olderPending = pendingUpdate("kb-1", OLDER);
        OsUpdate osUpdateOne = osUpdate("kb-1");
        OsUpdate osUpdateTwo = osUpdate("kb-2");
        DeviceOsPendingUpdateResponse newerResponse = DeviceOsPendingUpdateResponse.builder().identifier("kb-2").build();
        DeviceOsPendingUpdateResponse olderPendingResponse =
                DeviceOsPendingUpdateResponse.builder().identifier("kb-1").build();
        stubKnownDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(newerPending, olderPending));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-2", "kb-1")))
                .thenReturn(List.of(osUpdateOne, osUpdateTwo));
        when(deviceOsResponseMapper.toResponse(newerPending, osUpdateTwo)).thenReturn(newerResponse);
        when(deviceOsResponseMapper.toResponse(olderPending, osUpdateOne)).thenReturn(olderPendingResponse);

        // execution
        List<DeviceOsPendingUpdateResponse> found = service.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).containsExactly(newerResponse, olderPendingResponse);
    }

    @Test
    void listPendingUpdates_pendingUpdateWhoseOsUpdateIsNotStored_leftOut() {
        // setup
        DeviceOsPendingUpdate described = pendingUpdate("kb-2", NEWEST);
        DeviceOsPendingUpdate notDescribed = pendingUpdate("kb-1", OLDER);
        OsUpdate osUpdateTwo = osUpdate("kb-2");
        DeviceOsPendingUpdateResponse response = DeviceOsPendingUpdateResponse.builder().identifier("kb-2").build();
        stubKnownDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(described, notDescribed));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-2", "kb-1")))
                .thenReturn(List.of(osUpdateTwo));
        when(deviceOsResponseMapper.toResponse(described, osUpdateTwo)).thenReturn(response);

        // execution
        List<DeviceOsPendingUpdateResponse> found = service.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).containsExactly(response);
    }

    @Test
    void listPendingUpdates_deviceWithoutPendingUpdates_emptyAndNoOsUpdateRead() {
        // setup
        stubKnownDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of());

        // execution
        List<DeviceOsPendingUpdateResponse> found = service.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(osUpdateRepository, deviceOsResponseMapper);
    }

    @Test
    void listPendingUpdates_deviceThatIsNotManageable_emptyAndItsStoredPendingUpdatesNotRead() {
        // setup
        DeviceOsState notManageable = state(OsUpdateManageabilityState.NOT_MANAGEABLE);
        stubKnownDevice();
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(notManageable));

        // execution
        List<DeviceOsPendingUpdateResponse> found = service.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(deviceOsPendingUpdateRepository, osUpdateRepository, deviceOsResponseMapper);
    }

    @ParameterizedTest
    @MethodSource("statesThatDoNotHideThePendingUpdates")
    void listPendingUpdates_deviceThatIsNotKnownToBeNotManageable_pendingUpdatesReturned(DeviceOsState state) {
        // setup
        DeviceOsPendingUpdate pending = pendingUpdate("kb-1", NEWEST);
        OsUpdate osUpdate = osUpdate("kb-1");
        DeviceOsPendingUpdateResponse response = DeviceOsPendingUpdateResponse.builder().identifier("kb-1").build();
        stubKnownDevice();
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.ofNullable(state));
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(pending));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(TENANT_ID, OsPlatform.WINDOWS, List.of("kb-1")))
                .thenReturn(List.of(osUpdate));
        when(deviceOsResponseMapper.toResponse(pending, osUpdate)).thenReturn(response);

        // execution
        List<DeviceOsPendingUpdateResponse> found = service.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).containsExactly(response);
    }

    @Test
    void listPendingUpdates_unknownDevice_throwsDeviceNotFound() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> service.listPendingUpdates(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsPendingUpdateRepository, osUpdateRepository);
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
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3))
                .thenReturn(List.of(newestEntry, olderEntry, oldestEntry));
        stubHistoryResponses();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page = service.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        assertThat(page.getItems()).containsExactly(newestResponse, olderResponse);
        assertThat(page.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listUpdateHistory_lastPageAfterACursor_noNextPageAndAPreviousOne() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor("raw-4").build();
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(false)
                .hasPreviousPage(true)
                .startCursor(CursorCodec.encode("raw-3"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, "raw-4", 3))
                .thenReturn(List.of(newestEntry, olderEntry));
        stubHistoryResponses();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page = service.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        assertThat(page.getItems()).containsExactly(newestResponse, olderResponse);
        assertThat(page.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listUpdateHistory_deviceWithoutHistory_emptyPageWithoutCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        PageInfo expectedPageInfo = PageInfo.builder().hasNextPage(false).hasPreviousPage(false).build();
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3)).thenReturn(List.of());

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> page = service.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        assertThat(page.getItems()).isEmpty();
        assertThat(page.getPageInfo()).isEqualTo(expectedPageInfo);
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
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, expectedFetch))
                .thenReturn(List.of());

        // execution
        service.listUpdateHistory(MACHINE_ID, pagination);

        // verifications
        verify(deviceOsUpdateHistoryRepository).findPage(TENANT_ID, MACHINE_ID, null, expectedFetch);
    }

    @Test
    void listUpdateHistory_unknownDevice_throwsDeviceNotFound() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().build();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> service.listUpdateHistory(MACHINE_ID, pagination));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    private void stubKnownDevice() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(new Machine()));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubHistoryResponses() {
        when(deviceOsUpdateHistoryRepository.encodeCursor(newestEntry)).thenReturn("raw-3");
        when(deviceOsUpdateHistoryRepository.encodeCursor(olderEntry)).thenReturn("raw-2");
        when(deviceOsResponseMapper.toResponse(newestEntry, CursorCodec.encode("raw-3"))).thenReturn(newestResponse);
        when(deviceOsResponseMapper.toResponse(olderEntry, CursorCodec.encode("raw-2"))).thenReturn(olderResponse);
    }

    private static Stream<Arguments> statesThatDoNotHideThePendingUpdates() {
        DeviceOsState withoutManageability = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).build();
        return Stream.of(
                Arguments.of((DeviceOsState) null),
                Arguments.of(withoutManageability),
                Arguments.of(state(null)),
                Arguments.of(state(OsUpdateManageabilityState.MANAGEABLE)));
    }

    private static DeviceOsState state(OsUpdateManageabilityState manageabilityState) {
        OsUpdateManageability manageability = OsUpdateManageability.builder()
                .state(manageabilityState)
                .reasons(List.of())
                .build();
        return DeviceOsState.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .manageability(manageability)
                .build();
    }

    private static DeviceOsPendingUpdate pendingUpdate(String identifier, Instant discoveredAt) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static OsUpdate osUpdate(String identifier) {
        return OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .build();
    }
}
