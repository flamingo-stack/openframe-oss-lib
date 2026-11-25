package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.OsUpdateNotFoundException;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OsUpdateDeviceServiceTest {

    private static final String WINDOWS_ID = "id-windows";
    private static final String MAC_ID = "id-mac";
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final List<String> EVERY_ORGANIZATION = List.of();
    private static final List<String> EVERY_DEVICE = null;
    private static final List<String> ORGANIZATIONS = List.of("org-1");
    private static final List<String> ORGANIZATION_MACHINE_IDS = List.of("machine-1");

    @Mock private OsUpdateService osUpdateService;
    @Mock private DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    @Mock private DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    @Mock private DeviceService deviceService;
    @Spy private CursorPageAssembler cursorPageAssembler = new CursorPageAssembler();

    @InjectMocks private OsUpdateDeviceService osUpdateDeviceService;

    private final OsUpdate windowsUpdate = OsUpdate.builder()
            .id(WINDOWS_ID).platform(OsPlatform.WINDOWS).identifier(WINDOWS_IDENTIFIER).build();
    private final OsUpdate macUpdate = OsUpdate.builder()
            .id(MAC_ID).platform(OsPlatform.MACOS).identifier("Safari-18.2").build();

    @Test
    void listDevices_pending_pageOfThePendingDevicesWithANextPage() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(1).cursor("raw-0").build();
        OsUpdateDeviceResponse newer = device("machine-2", "raw-2");
        OsUpdateDeviceResponse older = device("machine-1", "raw-1");
        when(osUpdateService.getOsUpdate(WINDOWS_ID)).thenReturn(windowsUpdate);
        when(deviceOsPendingUpdateService.listOsUpdateDevices(windowsUpdate, EVERY_DEVICE, "raw-0", 2))
                .thenReturn(List.of(newer, older));
        PageInfo expectedPageInfo = PageInfo.builder()
                .hasNextPage(true)
                .hasPreviousPage(true)
                .startCursor(CursorCodec.encode("raw-2"))
                .endCursor(CursorCodec.encode("raw-2"))
                .build();

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices = osUpdateDeviceService.listDevices(
                WINDOWS_ID, OsUpdateDeviceStatus.PENDING, EVERY_ORGANIZATION, pagination);

        // verifications
        assertThat(devices.getItems()).containsExactly(newer);
        assertThat(devices.getPageInfo()).isEqualTo(expectedPageInfo);
        verifyNoInteractions(deviceOsUpdateHistoryService, deviceService);
    }

    @Test
    void listDevices_installedOfAWindowsUpdateForOrganizations_historyOfTheirDevicesAndNoPendingRead() {
        // setup
        CursorPaginationCriteria pagination = CursorPaginationCriteria.builder().limit(5).build();
        OsUpdateDeviceResponse installed = device("machine-1", "raw-1");
        when(osUpdateService.getOsUpdate(WINDOWS_ID)).thenReturn(windowsUpdate);
        when(deviceService.findDeviceIdsOfOrganizations(ORGANIZATIONS)).thenReturn(ORGANIZATION_MACHINE_IDS);
        when(deviceOsUpdateHistoryService.listOsUpdateDevices(WINDOWS_IDENTIFIER, ORGANIZATION_MACHINE_IDS, null, 6))
                .thenReturn(List.of(installed));

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices = osUpdateDeviceService.listDevices(
                WINDOWS_ID, OsUpdateDeviceStatus.INSTALLED, ORGANIZATIONS, pagination);

        // verifications
        assertThat(devices.getItems()).containsExactly(installed);
        assertThat(devices.getPageInfo())
                .extracting(PageInfo::isHasNextPage, PageInfo::isHasPreviousPage)
                .containsExactly(false, false);
        verifyNoInteractions(deviceOsPendingUpdateService);
    }

    @Test
    void listDevices_installedOfAMacUpdate_emptyAndTheHistoryNotRead() {
        // setup
        CursorPaginationCriteria pagination = new CursorPaginationCriteria();
        when(osUpdateService.getOsUpdate(MAC_ID)).thenReturn(macUpdate);

        // execution
        GenericQueryResult<OsUpdateDeviceResponse> devices = osUpdateDeviceService.listDevices(
                MAC_ID, OsUpdateDeviceStatus.INSTALLED, EVERY_ORGANIZATION, pagination);

        // verifications
        assertThat(devices.getItems()).isEmpty();
        verifyNoInteractions(deviceOsUpdateHistoryService, deviceOsPendingUpdateService);
    }

    @ParameterizedTest
    @EnumSource(OsUpdateDeviceStatus.class)
    void listDevices_noSuchUpdateInTheTenant_osUpdateNotFoundAndNoDeviceRead(OsUpdateDeviceStatus status) {
        // setup
        CursorPaginationCriteria pagination = new CursorPaginationCriteria();
        when(osUpdateService.getOsUpdate(WINDOWS_ID))
                .thenThrow(new OsUpdateNotFoundException("OS update not found: " + WINDOWS_ID));

        // execution
        OsUpdateNotFoundException ex = assertThrows(OsUpdateNotFoundException.class,
                () -> osUpdateDeviceService.listDevices(WINDOWS_ID, status, ORGANIZATIONS, pagination));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("OS update not found: " + WINDOWS_ID);
        verifyNoInteractions(deviceOsPendingUpdateService, deviceOsUpdateHistoryService, deviceService);
    }

    private static OsUpdateDeviceResponse device(String machineId, String rawCursor) {
        return OsUpdateDeviceResponse.builder().machineId(machineId).cursor(CursorCodec.encode(rawCursor)).build();
    }
}
