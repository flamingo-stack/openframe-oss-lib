package com.openframe.client.service.rmm;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.schedule.SoftwareSchedule;
import com.openframe.data.document.rmm.schedule.SoftwareScheduleOnlineDispatch;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleOnlineDispatchRepository;
import com.openframe.data.repository.rmm.SoftwareScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SoftwareScheduleOnlineDispatchServiceTest {

    private static final String TENANT = "t1";
    private static final String SCHEDULE_ID = "ss-1";

    @Mock private SoftwareScheduleOnlineDispatchRepository dispatchRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private SoftwareScheduleRepository scheduleRepository;
    @Mock private SoftwareScheduleFireDispatcher fireDispatcher;

    private SoftwareScheduleOnlineDispatchService service;

    @BeforeEach
    void setUp() {
        service = new SoftwareScheduleOnlineDispatchService(dispatchRepository, machineRepository, scheduleRepository, fireDispatcher);
        ReflectionTestUtils.setField(service, "batchSize", 500);
    }

    @Test
    @DisplayName("empty batch: nothing loaded or dispatched")
    void emptyBatch_noop() {
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of());

        service.processReconnectedDevices();

        verifyNoInteractions(machineRepository, scheduleRepository, fireDispatcher);
        verify(dispatchRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("reconnected device fires its schedule and is marked DISPATCHED; still-offline is left NEW; expired window is EXPIRED")
    void mixed_online_offline_expired() {
        Instant now = Instant.now();
        SoftwareScheduleOnlineDispatch online = sentinel("m-online", now.plusSeconds(3600));   // still in window
        SoftwareScheduleOnlineDispatch offline = sentinel("m-offline", now.plusSeconds(3600));  // still in window
        SoftwareScheduleOnlineDispatch expired = sentinel("m-expired", now.minusSeconds(10));   // window elapsed
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(online, offline, expired));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-online", DeviceStatus.ONLINE),
                        machine("m-offline", DeviceStatus.OFFLINE),
                        machine("m-expired", DeviceStatus.ONLINE)));
        SoftwareSchedule schedule = SoftwareSchedule.builder().id(SCHEDULE_ID).tenantId(TENANT).status(ScriptStatus.ACTIVE).build();
        when(scheduleRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(schedule));

        service.processReconnectedDevices();

        // Only the reconnected (online, in-window) device is fired.
        verify(fireDispatcher).dispatch(eq(schedule), eq(List.of("m-online")), any());
        verify(fireDispatcher, never()).dispatch(eq(schedule), eq(List.of("m-offline")), any());

        // Persisted: online → DISPATCHED, expired → EXPIRED. Offline stays NEW and is NOT saved.
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<SoftwareScheduleOnlineDispatch>> saved = ArgumentCaptor.forClass(List.class);
        verify(dispatchRepository).saveAll(saved.capture());
        assertThat(saved.getValue()).extracting(SoftwareScheduleOnlineDispatch::getMachineId)
                .containsExactlyInAnyOrder("m-online", "m-expired");
        assertThat(byId(saved.getValue(), "m-online").getStatus()).isEqualTo(DeviceOnlineDispatchStatus.DISPATCHED);
        assertThat(byId(saved.getValue(), "m-expired").getStatus()).isEqualTo(DeviceOnlineDispatchStatus.EXPIRED);
        assertThat(offline.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
    }

    private static SoftwareScheduleOnlineDispatch byId(List<SoftwareScheduleOnlineDispatch> list, String machineId) {
        return list.stream().filter(s -> s.getMachineId().equals(machineId)).findFirst().orElseThrow();
    }

    private static SoftwareScheduleOnlineDispatch sentinel(String machineId, Instant expiresAt) {
        return SoftwareScheduleOnlineDispatch.builder()
                .tenantId(TENANT).machineId(machineId).scheduleId(SCHEDULE_ID)
                .firstSeenAt(Instant.now().minusSeconds(60)).expiresAt(expiresAt)
                .status(DeviceOnlineDispatchStatus.NEW).build();
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine m = new Machine();
        m.setMachineId(machineId);
        m.setStatus(status);
        return m;
    }
}
