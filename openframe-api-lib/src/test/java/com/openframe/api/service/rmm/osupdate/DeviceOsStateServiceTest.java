package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.DeviceOsResponseMapper;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.DeviceOsState;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageability;
import com.openframe.data.document.rmm.osupdate.OsUpdateManageabilityState;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.ManageableOsDeviceCounts;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
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
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOsStateServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final Instant NEWEST = Instant.parse("2026-11-20T09:14:03.120Z");

    @Mock private DeviceOsStateRepository deviceOsStateRepository;
    @Mock private DeviceService deviceService;
    @Mock private DeviceOsResponseMapper deviceOsResponseMapper;
    @Mock private TenantIdProvider tenantIdProvider;

    @InjectMocks private DeviceOsStateService deviceOsStateService;

    @Test
    void findOsState_deviceThatReported_itsStateOfTheCallersTenant() {
        // setup
        DeviceOsState state = DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).receivedAt(NEWEST).build();
        DeviceOsStateResponse response = DeviceOsStateResponse.builder().receivedAt(NEWEST).build();
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.of(state));
        when(deviceOsResponseMapper.toResponse(state)).thenReturn(response);

        // execution
        DeviceOsStateResponse found = deviceOsStateService.findOsState(MACHINE_ID);

        // verifications
        assertThat(found).isSameAs(response);
    }

    @Test
    void findOsState_deviceThatNeverReported_null() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        DeviceOsStateResponse found = deviceOsStateService.findOsState(MACHINE_ID);

        // verifications
        assertThat(found).isNull();
        verifyNoInteractions(deviceOsResponseMapper);
    }

    @Test
    void findOsState_unknownDevice_throwsDeviceNotFound() {
        // setup
        doThrow(new DeviceNotFoundException("Device not found: " + MACHINE_ID))
                .when(deviceService).verifyExists(MACHINE_ID);

        // execution
        DeviceNotFoundException ex = assertThrows(DeviceNotFoundException.class,
                () -> deviceOsStateService.findOsState(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Device not found: " + MACHINE_ID);
        verifyNoInteractions(deviceOsStateRepository);
    }

    @Test
    void isNotManageable_deviceReportedNotManageable_true() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.of(state(OsUpdateManageabilityState.NOT_MANAGEABLE)));

        // execution
        boolean notManageable = deviceOsStateService.isNotManageable(MACHINE_ID);

        // verifications
        assertThat(notManageable).isTrue();
    }

    @ParameterizedTest
    @MethodSource("statesNotKnownToBeNotManageable")
    void isNotManageable_deviceNotKnownToBeNotManageable_false(DeviceOsState state) {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.findByTenantIdAndMachineId(TENANT_ID, MACHINE_ID))
                .thenReturn(Optional.ofNullable(state));

        // execution
        boolean notManageable = deviceOsStateService.isNotManageable(MACHINE_ID);

        // verifications
        assertThat(notManageable).isFalse();
    }

    @Test
    void listNotManageableMachineIds_statesInThatState_theirMachineIds() {
        // setup
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.findByTenantIdAndManageabilityState(
                TENANT_ID, OsUpdateManageabilityState.NOT_MANAGEABLE))
                .thenReturn(List.of(DeviceOsState.builder().machineId("machine-9").build()));

        // execution
        List<String> machineIds = deviceOsStateService.listNotManageableMachineIds();

        // verifications
        assertThat(machineIds).containsExactly("machine-9");
    }

    @Test
    void countManageableDevices_scopeOfMachines_countsOfTheRepositoryForTheTenant() {
        // setup
        ManageableOsDeviceCounts manageableOsDeviceCounts = new ManageableOsDeviceCounts(142, 7);
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(deviceOsStateRepository.countManageableDevices(TENANT_ID, OsPlatform.WINDOWS, List.of(MACHINE_ID)))
                .thenReturn(manageableOsDeviceCounts);

        // execution
        ManageableOsDeviceCounts found =
                deviceOsStateService.countManageableDevices(OsPlatform.WINDOWS, List.of(MACHINE_ID));

        // verifications
        assertThat(found).isSameAs(manageableOsDeviceCounts);
    }

    private static Stream<Arguments> statesNotKnownToBeNotManageable() {
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
        return DeviceOsState.builder().tenantId(TENANT_ID).machineId(MACHINE_ID).manageability(manageability).build();
    }
}
