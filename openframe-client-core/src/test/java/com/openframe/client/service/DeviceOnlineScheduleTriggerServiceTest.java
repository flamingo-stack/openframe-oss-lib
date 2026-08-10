package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.device.MachineFirstOnlineDispatch;
import com.openframe.data.repository.device.MachineFirstOnlineDispatchRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "m-1";

    @Mock private MachineFirstOnlineDispatchRepository dispatchRepository;

    @InjectMocks private DeviceOnlineScheduleTriggerService service;

    @Test
    @DisplayName("first ONLINE for a machine → sentinel row inserted with (tenantId, machineId, firstSeenAt)")
    void firstOnline_insertsSentinel() {
        service.onDeviceOnline(machine());

        ArgumentCaptor<MachineFirstOnlineDispatch> captor = ArgumentCaptor.forClass(MachineFirstOnlineDispatch.class);
        verify(dispatchRepository).save(captor.capture());
        MachineFirstOnlineDispatch saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo(TENANT);
        assertThat(saved.getMachineId()).isEqualTo(MACHINE);
        assertThat(saved.getFirstSeenAt()).isNotNull();
        assertThat(saved.getDispatchedAt()).isNull();   // pending until the cron worker fires it
    }

    @Test
    @DisplayName("subsequent OFFLINE→ONLINE for the same machine → duplicate insert swallowed, silent no-op (guarantees fire-once-ever)")
    void subsequentOnline_duplicateKeyIsSwallowed() {
        doThrow(new DuplicateKeyException("compound (tenantId, machineId) already exists"))
                .when(dispatchRepository).save(org.mockito.ArgumentMatchers.any(MachineFirstOnlineDispatch.class));

        // Must NOT throw — the whole point of the sentinel is that a re-online is a no-op.
        service.onDeviceOnline(machine());

        verify(dispatchRepository).save(org.mockito.ArgumentMatchers.any(MachineFirstOnlineDispatch.class));
    }

    @Test
    @DisplayName("event handler never dispatches directly — that's the cron worker's job (no Thread.sleep, no fire on the caller thread)")
    void neverDispatchesInline() {
        service.onDeviceOnline(machine());
        // dispatchRepository.save() is the ONLY side effect; nothing else on this service is
        // wired to a NATS fire path. Absence of any dispatch collaborator here is the assertion.
        verify(dispatchRepository, org.mockito.Mockito.only()).save(org.mockito.ArgumentMatchers.any());
    }

    private static Machine machine() {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(MACHINE);
        return m;
    }
}
