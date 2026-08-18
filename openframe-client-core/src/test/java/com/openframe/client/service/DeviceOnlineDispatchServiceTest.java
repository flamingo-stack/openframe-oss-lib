package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineDispatchService;
import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineDispatchServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String OTHER_TENANT = "tenant-2";
    private static final String MACHINE = "m-1";
    private static final String SCHEDULE = "s-1";
    private static final String ROW_ID = "row-1";

    @Mock private DeviceOnlineDispatchRepository dispatchRepository;
    @Mock private MachineRepository machineRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScheduleFireDispatcher fireDispatcher;

    @InjectMocks private DeviceOnlineDispatchService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "batchSize", 500);
    }

    @Test
    @DisplayName("NEW row + online machine + ACTIVE schedule → fires that scheduleId, row bulk-marked DISPATCHED")
    void online_firesRowSchedule() {
        DeviceFirstOnlineDispatch row = newRow(ROW_ID, MACHINE, SCHEDULE);
        ScriptSchedule s = schedule(SCHEDULE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenant(TENANT, List.of(onlineMachine(MACHINE)), List.of(s));

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(s), eq(List.of(MACHINE)), any(Instant.class));
        assertThat(savedDispatchedIds()).containsExactly(ROW_ID);
    }

    @Test
    @DisplayName("machine offline at tick → not fired, row stays NEW (no save)")
    void offlineMachine_staysNew() {
        DeviceFirstOnlineDispatch row = newRow(ROW_ID, MACHINE, SCHEDULE);
        Machine offline = onlineMachine(MACHINE);
        offline.setStatus(DeviceStatus.OFFLINE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenant(TENANT, List.of(offline), List.of(schedule(SCHEDULE)));

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        assertNothingDispatched();
    }

    @Test
    @DisplayName("machine missing → not fired, row stays NEW")
    void missingMachine_staysNew() {
        DeviceFirstOnlineDispatch row = newRow(ROW_ID, MACHINE, SCHEDULE);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenant(TENANT, List.of(), List.of(schedule(SCHEDULE)));

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        assertNothingDispatched();
    }

    @Test
    @DisplayName("online machine but schedule missing/inactive → drained (row DISPATCHED) WITHOUT firing")
    void onlineButScheduleGone_drainsWithoutFiring() {
        DeviceFirstOnlineDispatch row = newRow(ROW_ID, MACHINE, "deleted-schedule");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(row));
        stubTenant(TENANT, List.of(onlineMachine(MACHINE)), List.of());   // no active DEVICE_ONLINE schedules

        service.processDevicesBecameOnline();

        verify(fireDispatcher, never()).dispatch(any(), any(), any(Instant.class));
        assertThat(savedDispatchedIds()).containsExactly(ROW_ID);
    }

    @Test
    @DisplayName("each row fires ITS OWN scheduleId (two schedules on one online machine)")
    void firesPerRowSchedule() {
        DeviceFirstOnlineDispatch r1 = newRow("row-a", MACHINE, "s-a");
        DeviceFirstOnlineDispatch r2 = newRow("row-b", MACHINE, "s-b");
        ScriptSchedule sa = schedule("s-a");
        ScriptSchedule sb = schedule("s-b");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(r1, r2));
        stubTenant(TENANT, List.of(onlineMachine(MACHINE)), List.of(sa, sb));

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(sa), eq(List.of(MACHINE)), any(Instant.class));
        verify(fireDispatcher).dispatch(eq(sb), eq(List.of(MACHINE)), any(Instant.class));
        assertThat(savedDispatchedIds()).containsExactlyInAnyOrder("row-a", "row-b");
    }

    @Test
    @DisplayName("per-row dispatch throws → failing row NOT bulk-marked; siblings flushed")
    void dispatchFailure_isolatesFailingRow() {
        DeviceFirstOnlineDispatch bad = newRow("row-bad", "m-bad", "s-bad");
        DeviceFirstOnlineDispatch ok = newRow("row-ok", "m-ok", "s-ok");
        ScriptSchedule sBad = schedule("s-bad");
        ScriptSchedule sOk = schedule("s-ok");
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(bad, ok));
        stubTenant(TENANT, List.of(onlineMachine("m-bad"), onlineMachine("m-ok")), List.of(sBad, sOk));
        doThrow(new RuntimeException("nats down"))
                .when(fireDispatcher).dispatch(eq(sBad), eq(List.of("m-bad")), any(Instant.class));

        service.processDevicesBecameOnline();

        verify(fireDispatcher).dispatch(eq(sOk), eq(List.of("m-ok")), any(Instant.class));
        assertThat(savedDispatchedIds()).containsExactly("row-ok");
    }

    @Test
    @DisplayName("empty pending set → no work")
    void nothingPending_noWork() {
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of());

        service.processDevicesBecameOnline();

        verify(machineRepository, never()).findByTenantIdAndMachineIdIn(any(), any());
        verify(dispatchRepository, never()).saveAll(any());
    }

    @Test
    @DisplayName("batch is bounded at the DB by batchSize, ordered oldest-first")
    void batchBoundedAndOrdered() {
        ReflectionTestUtils.setField(service, "batchSize", 2);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class)))
                .thenReturn(List.of(newRow("row-a", "m-a", "s-a")));
        stubTenant(TENANT, List.of(), List.of());

        service.processDevicesBecameOnline();

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(dispatchRepository).findByStatus(eq(DeviceOnlineDispatchStatus.NEW), pageable.capture());
        assertThat(pageable.getValue().getPageSize()).isEqualTo(2);
        assertThat(pageable.getValue().getSort()).isEqualTo(Sort.by(Sort.Direction.ASC, "firstSeenAt"));
    }

    @Test
    @DisplayName("cross-tenant: bulk reads per tenant, ONE global bulk-mark")
    void multiTenant() {
        DeviceFirstOnlineDispatch a = newRow("row-a", "m-a", "s-a");
        a.setTenantId(TENANT);
        DeviceFirstOnlineDispatch b = newRow("row-b", "m-b", "s-b");
        b.setTenantId(OTHER_TENANT);
        when(dispatchRepository.findByStatus(eq(DeviceOnlineDispatchStatus.NEW), any(Pageable.class))).thenReturn(List.of(a, b));
        stubTenant(TENANT, List.of(onlineMachine("m-a")), List.of(schedule("s-a")));
        stubTenant(OTHER_TENANT, List.of(onlineMachine("m-b")), List.of(schedule("s-b")));

        service.processDevicesBecameOnline();

        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(TENANT), any());
        verify(machineRepository).findByTenantIdAndMachineIdIn(eq(OTHER_TENANT), any());
        verify(dispatchRepository, times(1)).saveAll(any());
        assertThat(savedDispatchedIds()).containsExactlyInAnyOrder("row-a", "row-b");
    }

    private void stubTenant(String tenantId, List<Machine> machines, List<ScriptSchedule> schedules) {
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(tenantId), any())).thenReturn(machines);
        when(scheduleRepository.findByTenantIdAndTriggerAndStatus(tenantId, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(schedules);
    }

    private void assertNothingDispatched() {
        ArgumentCaptor<Iterable<DeviceFirstOnlineDispatch>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(dispatchRepository).saveAll(captor.capture());
        assertThat(captor.getValue()).isEmpty();
    }

    private List<String> savedDispatchedIds() {
        ArgumentCaptor<Iterable<DeviceFirstOnlineDispatch>> captor = ArgumentCaptor.forClass(Iterable.class);
        verify(dispatchRepository).saveAll(captor.capture());
        List<DeviceFirstOnlineDispatch> saved = new ArrayList<>();
        captor.getValue().forEach(saved::add);
        assertThat(saved).allMatch(r -> r.getStatus() == DeviceOnlineDispatchStatus.DISPATCHED);
        assertThat(saved).allMatch(r -> r.getDispatchedAt() != null);
        return saved.stream().map(DeviceFirstOnlineDispatch::getId).toList();
    }

    private static DeviceFirstOnlineDispatch newRow(String id, String machineId, String scheduleId) {
        return DeviceFirstOnlineDispatch.builder()
                .id(id).tenantId(TENANT).machineId(machineId).scheduleId(scheduleId)
                .status(DeviceOnlineDispatchStatus.NEW).firstSeenAt(Instant.EPOCH).build();
    }

    private static ScriptSchedule schedule(String id) {
        return ScriptSchedule.builder().id(id).tenantId(TENANT).build();
    }

    private static Machine onlineMachine(String machineId) {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(machineId);
        m.setStatus(DeviceStatus.ONLINE);
        return m;
    }
}
