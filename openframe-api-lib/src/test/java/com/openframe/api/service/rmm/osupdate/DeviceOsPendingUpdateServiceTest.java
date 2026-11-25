package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.DeviceOsPendingUpdateResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.mapper.OsUpdateResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.DeviceOsPendingUpdateRepository;
import com.openframe.data.repository.rmm.osupdate.OsUpdateDeviceCount;
import com.openframe.data.repository.rmm.osupdate.OsUpdateIdentifiersOfPlatform;
import com.openframe.data.repository.rmm.osupdate.OsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsPendingUpdateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final List<String> NOT_MANAGEABLE_MACHINE_IDS = List.of("machine-9");
    private static final List<String> EVERY_DEVICE = null;
    private static final Instant NEWEST = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant OLDER = Instant.parse("2026-11-18T07:02:11Z");

    @Mock private DeviceOsPendingUpdateRepository deviceOsPendingUpdateRepository;
    @Mock private OsUpdateRepository osUpdateRepository;
    @Mock private DeviceOsStateService deviceOsStateService;
    @Mock private DeviceService deviceService;
    @Mock private DeviceOsResponseMapper deviceOsResponseMapper;
    @Mock private OsUpdateResponseMapper osUpdateResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private DeviceOsPendingUpdateService deviceOsPendingUpdateService;

    @Test
    void listPendingUpdates_pendingUpdatesWithTheirOsUpdates_joinedInTheOrderOfTheRepository() {
        // setup
        DeviceOsPendingUpdate newerPending = pendingUpdate(MACHINE_ID, "kb-2", NEWEST);
        DeviceOsPendingUpdate olderPending = pendingUpdate(MACHINE_ID, "kb-1", OLDER);
        OsUpdate osUpdateOne = osUpdate("kb-1");
        OsUpdate osUpdateTwo = osUpdate("kb-2");
        DeviceOsPendingUpdateResponse newerResponse = DeviceOsPendingUpdateResponse.builder().identifier("kb-2").build();
        DeviceOsPendingUpdateResponse olderResponse = DeviceOsPendingUpdateResponse.builder().identifier("kb-1").build();
        stubManageableDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(newerPending, olderPending));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-2", "kb-1")))
                .thenReturn(List.of(osUpdateOne, osUpdateTwo));
        when(deviceOsResponseMapper.toResponse(newerPending, osUpdateTwo)).thenReturn(newerResponse);
        when(deviceOsResponseMapper.toResponse(olderPending, osUpdateOne)).thenReturn(olderResponse);

        // execution
        List<DeviceOsPendingUpdateResponse> found = deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).containsExactly(newerResponse, olderResponse);
    }

    @Test
    void listPendingUpdates_pendingUpdateWhoseOsUpdateIsNotStored_leftOut() {
        // setup
        DeviceOsPendingUpdate described = pendingUpdate(MACHINE_ID, "kb-2", NEWEST);
        DeviceOsPendingUpdate notDescribed = pendingUpdate(MACHINE_ID, "kb-1", OLDER);
        OsUpdate osUpdateTwo = osUpdate("kb-2");
        DeviceOsPendingUpdateResponse response = DeviceOsPendingUpdateResponse.builder().identifier("kb-2").build();
        stubManageableDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of(described, notDescribed));
        when(osUpdateRepository.findByTenantIdAndPlatformAndIdentifierIn(
                TENANT_ID, OsPlatform.WINDOWS, List.of("kb-2", "kb-1")))
                .thenReturn(List.of(osUpdateTwo));
        when(deviceOsResponseMapper.toResponse(described, osUpdateTwo)).thenReturn(response);

        // execution
        List<DeviceOsPendingUpdateResponse> found = deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).containsExactly(response);
    }

    @Test
    void listPendingUpdates_deviceWithoutPendingUpdates_emptyAndNoOsUpdateRead() {
        // setup
        stubManageableDevice();
        when(deviceOsPendingUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescIdentifierAsc(TENANT_ID, MACHINE_ID))
                .thenReturn(List.of());

        // execution
        List<DeviceOsPendingUpdateResponse> found = deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(osUpdateRepository, deviceOsResponseMapper);
    }

    @Test
    void listPendingUpdates_deviceThatIsNotManageable_emptyAndItsStoredPendingUpdatesNotRead() {
        // setup
        when(deviceOsStateService.isNotManageable(MACHINE_ID)).thenReturn(true);

        // execution
        List<DeviceOsPendingUpdateResponse> found = deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID);

        // verifications
        assertThat(found).isEmpty();
        verifyNoInteractions(deviceOsPendingUpdateRepository, osUpdateRepository, deviceOsResponseMapper);
    }

    @Test
    void listPendingUpdates_unknownDevice_throwsDeviceNotFound() {
        // setup
        doThrow(new DeviceNotFoundException("Device not found: " + MACHINE_ID))
                .when(deviceService).verifyExists(MACHINE_ID);

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> deviceOsPendingUpdateService.listPendingUpdates(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsPendingUpdateRepository, osUpdateRepository);
    }

    @Test
    void countDevicesByIdentifier_everyDevice_countedWithoutTheNotManageableDevices() {
        // setup
        List<OsUpdateDeviceCount> deviceCounts = List.of(new OsUpdateDeviceCount(IDENTIFIER, 7));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateService.listNotManageableMachineIds()).thenReturn(NOT_MANAGEABLE_MACHINE_IDS);
        when(deviceOsPendingUpdateRepository.countDevicesByIdentifier(
                TENANT_ID, OsPlatform.WINDOWS, List.of(IDENTIFIER), NOT_MANAGEABLE_MACHINE_IDS))
                .thenReturn(deviceCounts);

        // execution
        List<OsUpdateDeviceCount> found = deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(IDENTIFIER), EVERY_DEVICE);

        // verifications
        assertThat(found).isSameAs(deviceCounts);
    }

    @Test
    void countDevicesByIdentifier_scopeOfMachines_countedOnTheManageableOnesOfThemOnly() {
        // setup
        List<OsUpdateDeviceCount> deviceCounts = List.of(new OsUpdateDeviceCount(IDENTIFIER, 1));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateService.listNotManageableMachineIds()).thenReturn(NOT_MANAGEABLE_MACHINE_IDS);
        when(deviceOsPendingUpdateRepository.countDevicesByIdentifierOnMachines(
                TENANT_ID, OsPlatform.WINDOWS, List.of(IDENTIFIER), List.of(MACHINE_ID)))
                .thenReturn(deviceCounts);

        // execution
        List<OsUpdateDeviceCount> found = deviceOsPendingUpdateService.countDevicesByIdentifier(
                OsPlatform.WINDOWS, List.of(IDENTIFIER), List.of(MACHINE_ID, "machine-9"));

        // verifications
        assertThat(found).isSameAs(deviceCounts);
        verify(deviceOsPendingUpdateRepository, never()).countDevicesByIdentifier(any(), any(), any(), any());
    }

    @Test
    void listIdentifiersByPlatform_machines_identifiersOfTheirPendingRows() {
        // setup
        List<OsUpdateIdentifiersOfPlatform> identifiers =
                List.of(new OsUpdateIdentifiersOfPlatform(OsPlatform.WINDOWS, List.of(IDENTIFIER)));
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsPendingUpdateRepository.findIdentifiersByPlatformOnMachines(TENANT_ID, List.of(MACHINE_ID)))
                .thenReturn(identifiers);

        // execution
        List<OsUpdateIdentifiersOfPlatform> found =
                deviceOsPendingUpdateService.listIdentifiersByPlatform(List.of(MACHINE_ID));

        // verifications
        assertThat(found).isSameAs(identifiers);
    }

    @Test
    void listOsUpdateDevices_pageOfRows_withoutNotManageableDevicesWithinTheScopeEachWithItsCursor() {
        // setup
        OsUpdate osUpdate = osUpdate(IDENTIFIER);
        DeviceOsPendingUpdate pending = pendingUpdate("machine-2", IDENTIFIER, NEWEST);
        OsUpdateDeviceResponse response = OsUpdateDeviceResponse.builder().machineId("machine-2").build();
        List<String> scopeMachineIds = List.of("machine-2");
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateService.listNotManageableMachineIds()).thenReturn(NOT_MANAGEABLE_MACHINE_IDS);
        when(deviceOsPendingUpdateRepository.findDevicePage(TENANT_ID, OsPlatform.WINDOWS, IDENTIFIER,
                NOT_MANAGEABLE_MACHINE_IDS, scopeMachineIds, "raw-0", 2)).thenReturn(List.of(pending));
        when(deviceOsPendingUpdateRepository.encodeDeviceCursor(pending)).thenReturn("raw-2");
        when(osUpdateResponseMapper.toPendingDeviceResponse(pending, CursorCodec.encode("raw-2"))).thenReturn(response);

        // execution
        List<OsUpdateDeviceResponse> found =
                deviceOsPendingUpdateService.listOsUpdateDevices(osUpdate, scopeMachineIds, "raw-0", 2);

        // verifications
        assertThat(found).containsExactly(response);
    }

    private void stubManageableDevice() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateService.isNotManageable(MACHINE_ID)).thenReturn(false);
    }

    private static DeviceOsPendingUpdate pendingUpdate(String machineId, String identifier, Instant discoveredAt) {
        return DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(machineId)
                .platform(OsPlatform.WINDOWS)
                .identifier(identifier)
                .discoveredAt(discoveredAt)
                .build();
    }

    private static OsUpdate osUpdate(String identifier) {
        return OsUpdate.builder().tenantId(TENANT_ID).platform(OsPlatform.WINDOWS).identifier(identifier).build();
    }
}
