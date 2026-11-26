package com.openframe.client.service.auth;

import com.openframe.client.exception.MachineDeletedException;
import com.openframe.client.exception.TenantBlockedException;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tenant.Tenant;
import com.openframe.data.document.tenant.TenantStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tenant.TenantRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MachineTokenGuardTest {

    private static final String MACHINE_ID = "machine-1";
    private static final String TENANT_ID = "tenant-1";

    @Mock private MachineRepository machineRepository;
    @Mock private TenantRepository tenantRepository;

    private MachineTokenGuard guard;
    private Machine machine;
    private Tenant tenant;

    @BeforeEach
    void setUp() {
        guard = new MachineTokenGuard(machineRepository, tenantRepository, true);
        machine = new Machine();
        machine.setMachineId(MACHINE_ID);
        tenant = new Tenant();
        tenant.setId(TENANT_ID);
    }

    @Test
    void requireTokenAllowed_deletedMachine_throwsMachineDeleted() {
        // setup
        machine.setStatus(DeviceStatus.DELETED);
        machine.setTenantId(TENANT_ID);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        MachineDeletedException ex = assertThrows(MachineDeletedException.class,
                () -> guard.requireTokenAllowed(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(MachineTokenGuard.MACHINE_DELETED);
        verifyNoInteractions(tenantRepository);
    }

    @ParameterizedTest
    @EnumSource(value = DeviceStatus.class, names = "DELETED", mode = EnumSource.Mode.EXCLUDE)
    void requireTokenAllowed_machineNotDeleted_passes(DeviceStatus status) {
        // setup
        machine.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));

        // execution
        Runnable call = () -> guard.requireTokenAllowed(MACHINE_ID);

        // verifications
        assertThatCode(call::run).doesNotThrowAnyException();
    }

    @Test
    void requireTokenAllowed_blockedTenant_throwsTenantBlocked() {
        // setup
        machine.setTenantId(TENANT_ID);
        tenant.setStatus(TenantStatus.BLOCKED);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));

        // execution
        TenantBlockedException ex = assertThrows(TenantBlockedException.class,
                () -> guard.requireTokenAllowed(MACHINE_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo(MachineTokenGuard.TENANT_BLOCKED);
    }

    @ParameterizedTest
    @EnumSource(value = TenantStatus.class, names = "BLOCKED", mode = EnumSource.Mode.EXCLUDE)
    void requireTokenAllowed_tenantNotBlocked_passes(TenantStatus status) {
        // setup
        machine.setTenantId(TENANT_ID);
        tenant.setStatus(status);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.of(tenant));

        // execution
        Runnable call = () -> guard.requireTokenAllowed(MACHINE_ID);

        // verifications
        assertThatCode(call::run).doesNotThrowAnyException();
    }

    @Test
    void requireTokenAllowed_tenantNotFound_passes() {
        // setup
        machine.setTenantId(TENANT_ID);
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.of(machine));
        when(tenantRepository.findById(TENANT_ID)).thenReturn(Optional.empty());

        // execution
        guard.requireTokenAllowed(MACHINE_ID);

        // verifications
        verify(tenantRepository).findById(TENANT_ID);
    }

    @Test
    void requireTokenAllowed_machineNotFound_passesWithoutTenantLookup() {
        // setup
        when(machineRepository.findByMachineId(MACHINE_ID)).thenReturn(Optional.empty());

        // execution
        guard.requireTokenAllowed(MACHINE_ID);

        // verifications
        verify(machineRepository).findByMachineId(MACHINE_ID);
        verifyNoInteractions(tenantRepository);
    }

    @Test
    void requireTokenAllowed_nullMachineId_passesWithoutLookup() {
        // setup
        String machineId = null;

        // execution
        guard.requireTokenAllowed(machineId);

        // verifications
        verifyNoInteractions(machineRepository, tenantRepository);
    }

    @Test
    void requireTokenAllowed_flagOff_passesWithoutLookup() {
        // setup
        MachineTokenGuard disabled = new MachineTokenGuard(machineRepository, tenantRepository, false);

        // execution
        disabled.requireTokenAllowed(MACHINE_ID);

        // verifications
        verifyNoInteractions(machineRepository, tenantRepository);
    }
}
