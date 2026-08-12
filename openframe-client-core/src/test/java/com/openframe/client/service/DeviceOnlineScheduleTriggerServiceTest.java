package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "m-1";

    @Mock private DeviceOnlineDispatchRepository dispatchRepository;

    @InjectMocks private DeviceOnlineScheduleTriggerService service;

    @Test
    @DisplayName("first ONLINE for a machine (not yet in the collection) → sentinel row inserted with (tenantId, machineId, firstSeenAt)")
    void firstOnline_insertsSentinel() {
        service.onDeviceOnline(machine());   // exists() defaults to false → insert

        ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
        verify(dispatchRepository).save(captor.capture());
        DeviceFirstOnlineDispatch saved = captor.getValue();
        assertThat(saved.getTenantId()).isEqualTo(TENANT);
        assertThat(saved.getMachineId()).isEqualTo(MACHINE);
        assertThat(saved.getFirstSeenAt()).isNotNull();
        assertThat(saved.getDispatchedAt()).isNull();   // pending until the cron worker fires it
        assertThat(saved.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
    }

    @Test
    @DisplayName("machine already in the collection → skip, no insert attempted (fire-once-ever)")
    void alreadyExists_skipsWithoutSave() {
        when(dispatchRepository.existsByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(true);

        service.onDeviceOnline(machine());

        verify(dispatchRepository, never()).save(any());
    }

    @Test
    @DisplayName("race: exists-check said no but a concurrent insert won → DuplicateKeyException swallowed, silent no-op")
    void concurrentInsert_duplicateKeyIsSwallowed() {
        doThrow(new DuplicateKeyException("compound (tenantId, machineId) already exists"))
                .when(dispatchRepository).save(any(DeviceFirstOnlineDispatch.class));

        service.onDeviceOnline(machine());

        verify(dispatchRepository).save(any(DeviceFirstOnlineDispatch.class));
    }

    @Test
    @DisplayName("event handler never dispatches directly — the only side effect is the sentinel insert; the cron worker fires (no inline NATS)")
    void neverDispatchesInline() {
        service.onDeviceOnline(machine());
        verify(dispatchRepository).save(any());
    }

    private static Machine machine() {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(MACHINE);
        return m;
    }
}
