package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.OsUpdateMapper;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdate;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateServiceTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";
    private static final String RAW_CURSOR = "1795142470000|6aff19c07ce86a3f0386ff82";

    @Mock private MachineRepository machineRepository;
    @Mock private DeviceOsUpdateRepository deviceOsUpdateRepository;
    @Mock private DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    @Mock private OsUpdateMapper osUpdateMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private OsUpdateService service;

    private Machine machine;
    private DeviceOsUpdateHistoryEntry newest;
    private DeviceOsUpdateHistoryEntry middle;
    private DeviceOsUpdateHistoryEntry oldest;
    private DeviceOsUpdateHistoryEntryResponse newestResponse;
    private DeviceOsUpdateHistoryEntryResponse middleResponse;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        newest = DeviceOsUpdateHistoryEntry.builder().id("id-newest").build();
        middle = DeviceOsUpdateHistoryEntry.builder().id("id-middle").build();
        oldest = DeviceOsUpdateHistoryEntry.builder().id("id-oldest").build();
        newestResponse = DeviceOsUpdateHistoryEntryResponse.builder().cursor(CursorCodec.encode("raw-newest")).build();
        middleResponse = DeviceOsUpdateHistoryEntryResponse.builder().cursor(CursorCodec.encode("raw-middle")).build();
    }

    @Test
    void listPendingForDevice_unknownDevice_throwsDeviceNotFound() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> service.listPendingForDevice(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsUpdateRepository);
    }

    @Test
    void listPendingForDevice_knownDevice_updatesOfItsTenantInTheStoredOrder() {
        // setup
        DeviceOsUpdate first = DeviceOsUpdate.builder().updateKey("k-1").build();
        DeviceOsUpdate second = DeviceOsUpdate.builder().updateKey("k-2").build();
        DeviceOsUpdateResponse firstResponse = DeviceOsUpdateResponse.builder().updateKey("k-1").build();
        DeviceOsUpdateResponse secondResponse = DeviceOsUpdateResponse.builder().updateKey("k-2").build();
        stubKnownDevice();
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(first, second));
        when(osUpdateMapper.toResponse(first)).thenReturn(firstResponse);
        when(osUpdateMapper.toResponse(second)).thenReturn(secondResponse);

        // execution
        List<DeviceOsUpdateResponse> pending = service.listPendingForDevice(MACHINE_ID);

        // verifications
        assertThat(pending).containsExactly(firstResponse, secondResponse);
    }

    @Test
    void listPendingForDevice_nothingPending_emptyList() {
        // setup
        stubKnownDevice();
        when(deviceOsUpdateRepository.findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of());

        // execution
        List<DeviceOsUpdateResponse> pending = service.listPendingForDevice(MACHINE_ID);

        // verifications
        assertThat(pending).isEmpty();
    }

    @Test
    void listHistoryForDevice_unknownDevice_throwsDeviceNotFound() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> service.listHistoryForDevice(MACHINE_ID, pagination));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsUpdateHistoryRepository);
    }

    @Test
    void listHistoryForDevice_oneEntryBeyondThePage_pageOfTheLimitWithANextPage() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        stubKnownDevice();
        stubCursorOf(newest, "raw-newest", newestResponse);
        stubCursorOf(middle, "raw-middle", middleResponse);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3))
                .thenReturn(List.of(newest, middle, oldest));
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(false)
                .startCursor(newestResponse.getCursor())
                .endCursor(middleResponse.getCursor())
                .build();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> history =
                service.listHistoryForDevice(MACHINE_ID, pagination);

        // verifications
        assertThat(history.getItems()).containsExactly(newestResponse, middleResponse);
        assertThat(history.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listHistoryForDevice_exactlyThePage_noNextPage() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        stubKnownDevice();
        stubCursorOf(newest, "raw-newest", newestResponse);
        stubCursorOf(middle, "raw-middle", middleResponse);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3))
                .thenReturn(List.of(newest, middle));

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> history =
                service.listHistoryForDevice(MACHINE_ID, pagination);

        // verifications
        assertThat(history.getItems()).containsExactly(newestResponse, middleResponse);
        assertThat(history.getPageInfo().isHasNextPage()).isFalse();
    }

    @Test
    void listHistoryForDevice_afterACursor_readFromItAndThePreviousPageExists() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).cursor(RAW_CURSOR).build();
        stubKnownDevice();
        stubCursorOf(middle, "raw-middle", middleResponse);
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, RAW_CURSOR, 3))
                .thenReturn(List.of(middle));
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(false)
                .hasPreviousPage(true)
                .startCursor(middleResponse.getCursor())
                .endCursor(middleResponse.getCursor())
                .build();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> history =
                service.listHistoryForDevice(MACHINE_ID, pagination);

        // verifications
        assertThat(history.getItems()).containsExactly(middleResponse);
        assertThat(history.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @Test
    void listHistoryForDevice_noHistory_emptyPageWithoutCursors() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(2).build();
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, 3)).thenReturn(List.of());
        PageInfo expectedPageInfo = PageInfo.builder().build();

        // execution
        GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> history =
                service.listHistoryForDevice(MACHINE_ID, pagination);

        // verifications
        assertThat(history.getItems()).isEmpty();
        assertThat(history.getPageInfo()).isEqualTo(expectedPageInfo);
    }

    @ParameterizedTest
    @CsvSource(value = {
            "NULL, 21",
            "0,    2",
            "-5,   2",
            "100,  101",
            "500,  101"
    }, nullValues = "NULL")
    void listHistoryForDevice_limitAbsentOrOutOfRange_twentyByDefaultAndBetweenOneAndAHundred(
            Integer limit, int expectedRead) {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(limit).build();
        stubKnownDevice();
        when(deviceOsUpdateHistoryRepository.findPage(TENANT_ID, MACHINE_ID, null, expectedRead))
                .thenReturn(List.of());

        // execution
        service.listHistoryForDevice(MACHINE_ID, pagination);

        // verifications
        verify(deviceOsUpdateHistoryRepository).findPage(TENANT_ID, MACHINE_ID, null, expectedRead);
    }

    private void stubKnownDevice() {
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
    }

    private void stubCursorOf(DeviceOsUpdateHistoryEntry entry, String rawCursor,
                              DeviceOsUpdateHistoryEntryResponse response) {
        when(deviceOsUpdateHistoryRepository.encodeCursor(entry)).thenReturn(rawCursor);
        when(osUpdateMapper.toResponse(entry, CursorCodec.encode(rawCursor))).thenReturn(response);
    }
}
