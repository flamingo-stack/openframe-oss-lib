package com.openframe.client.service;

import com.openframe.client.service.rmm.DeviceOnlineScheduleTriggerService;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DuplicateKeyException;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DeviceOnlineScheduleTriggerServiceTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "m-1";

    @Mock private DeviceOnlineDispatchRepository dispatchRepository;
    @Mock private ScriptScheduleRepository scheduleRepository;
    @Mock private ScriptScheduleMachineAssignedRepository assignedRepository;
    @Mock private ScheduleDeviceTargetResolver targetResolver;

    @InjectMocks private DeviceOnlineScheduleTriggerService service;

    @Nested
    @DisplayName("onDeviceWentOffline (ONLINE→OFFLINE) — arms only when a DEVICE_ONLINE schedule targets the machine")
    class WentOffline {

        @Test
        @DisplayName("no DEVICE_ONLINE schedules → not armed, dispatch collection not even read")
        void noSchedules_notArmed() {
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of());

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository, never()).findByTenantIdAndMachineId(any(), any());
            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("schedules exist but none targets this machine → not armed")
        void notTargeted_notArmed() {
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of(schedule("s1", ScheduleDeviceSelectionMode.SPECIFIC)));
            when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("assigned to a DIFFERENT schedule than the DEVICE_ONLINE one → not armed")
        void assignedToDifferentSchedule_notArmed() {
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of(schedule("s1", ScheduleDeviceSelectionMode.SPECIFIC)));
            when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(List.of(assignment("s2")));   // assigned, but not to s1

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("CRITERIA DEVICE_ONLINE schedule that does NOT match the machine → not armed")
        void criteriaNoMatch_notArmed() {
            ScriptSchedule criteria = schedule("c1", ScheduleDeviceSelectionMode.CRITERIA);
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of(criteria));
            when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());
            when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(false);

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("assigned to a SPECIFIC DEVICE_ONLINE schedule + no row → sentinel inserted ARMED")
        void assignedSpecific_insertsArmed() {
            stubTargeted();
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());

            service.onDeviceWentOffline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            DeviceFirstOnlineDispatch saved = captor.getValue();
            assertThat(saved.getTenantId()).isEqualTo(TENANT);
            assertThat(saved.getMachineId()).isEqualTo(MACHINE);
            assertThat(saved.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);
            assertThat(saved.getFirstSeenAt()).isNotNull();
            assertThat(saved.getDispatchedAt()).isNull();
        }

        @Test
        @DisplayName("matches a CRITERIA DEVICE_ONLINE schedule (no explicit assignment) + no row → sentinel inserted ARMED")
        void criteriaMatch_insertsArmed() {
            ScriptSchedule criteria = schedule("c1", ScheduleDeviceSelectionMode.CRITERIA);
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of(criteria));
            when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());
            when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(true);
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());

            service.onDeviceWentOffline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);
        }

        @Test
        @DisplayName("targeted by CRITERIA when SPECIFIC one doesn't match → armed (any matching schedule is enough)")
        void mixedSpecificNotAssignedButCriteriaMatches_armed() {
            ScriptSchedule specific = schedule("s1", ScheduleDeviceSelectionMode.SPECIFIC);
            ScriptSchedule criteria = schedule("c1", ScheduleDeviceSelectionMode.CRITERIA);
            when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                    .thenReturn(List.of(specific, criteria));
            when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(List.of());   // not assigned to s1
            when(targetResolver.matchesCriteria(eq(criteria), any(Machine.class))).thenReturn(true);
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository).save(any(DeviceFirstOnlineDispatch.class));
        }

        @Test
        @DisplayName("existing PROCESSED sentinel (prior cycle) → re-armed to ARMED, dispatchedAt cleared")
        void processedRow_reArmed() {
            stubTargeted();
            DeviceFirstOnlineDispatch prior = row(DeviceOnlineDispatchStatus.PROCESSED);
            prior.setDispatchedAt(Instant.EPOCH);
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.of(prior));

            service.onDeviceWentOffline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);
            assertThat(captor.getValue().getDispatchedAt()).isNull();
        }

        @Test
        @DisplayName("existing DISPATCHED sentinel (fired, no result yet) → re-armed to ARMED")
        void dispatchedRow_reArmed() {
            stubTargeted();
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.DISPATCHED)));

            service.onDeviceWentOffline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);
        }

        @Test
        @DisplayName("existing NEW sentinel (queued but device flapped offline before worker fired) → re-armed to ARMED")
        void newRow_reArmed() {
            stubTargeted();
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.NEW)));

            service.onDeviceWentOffline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);
        }

        @Test
        @DisplayName("existing ARMED sentinel → no-op (already armed)")
        void alreadyArmed_noOp() {
            stubTargeted();
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.ARMED)));

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("race: no row on read but concurrent insert won → DuplicateKeyException swallowed")
        void insertRace_swallowed() {
            stubTargeted();
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());
            doThrow(new DuplicateKeyException("dup")).when(dispatchRepository).save(any(DeviceFirstOnlineDispatch.class));

            service.onDeviceWentOffline(machine());

            verify(dispatchRepository).save(any(DeviceFirstOnlineDispatch.class));
        }
    }

    @Nested
    @DisplayName("onDeviceCameOnline (OFFLINE→ONLINE) — queues only a genuine reconnect (ARMED sentinel)")
    class CameOnline {

        @Test
        @DisplayName("ARMED sentinel → flipped to NEW (worker will fire) — the reconnect case")
        void armed_flippedToNew() {
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.ARMED)));

            service.onDeviceCameOnline(machine());

            ArgumentCaptor<DeviceFirstOnlineDispatch> captor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
            verify(dispatchRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
            assertThat(captor.getValue().getFirstSeenAt()).isNotNull();
        }

        @Test
        @DisplayName("no sentinel (first connect after being assigned while offline) → nothing queued, schedules not consulted")
        void noSentinel_nothing() {
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE)).thenReturn(Optional.empty());

            service.onDeviceCameOnline(machine());

            verify(dispatchRepository, never()).save(any());
            verifyNoInteractions(scheduleRepository, assignedRepository, targetResolver);
        }

        @Test
        @DisplayName("sentinel PROCESSED (no genuine offline in between) → nothing queued")
        void processed_nothing() {
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.PROCESSED)));

            service.onDeviceCameOnline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("sentinel already NEW (duplicate online event before worker ran) → no double-queue")
        void alreadyNew_noOp() {
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.NEW)));

            service.onDeviceCameOnline(machine());

            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("sentinel DISPATCHED (already fired) → nothing queued")
        void dispatched_nothing() {
            when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                    .thenReturn(Optional.of(row(DeviceOnlineDispatchStatus.DISPATCHED)));

            service.onDeviceCameOnline(machine());

            verify(dispatchRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("end-to-end scenarios (stateful repo) — the two cases from the report + repeat")
    class Scenarios {

        @Test
        @DisplayName("CASE 1: online → assign → online→offline → offline→online ⇒ queued NEW (fires)")
        void case1_reconnectFires() {
            StatefulRepo repo = statefulTargeted();

            // online→offline while assigned → ARMED
            service.onDeviceWentOffline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);

            // offline→online → NEW (worker will pick it up)
            service.onDeviceCameOnline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        }

        @Test
        @DisplayName("CASE 2: offline → assign → offline→online ⇒ nothing recorded (does NOT fire)")
        void case2_firstConnectDoesNotFire() {
            StatefulRepo repo = statefulTargeted();

            // device was offline when assigned: no online→offline happened → only the online event fires
            service.onDeviceCameOnline(machine());

            assertThat(repo.current()).isNull();   // never armed, nothing queued
            verify(dispatchRepository, never()).save(any());
        }

        @Test
        @DisplayName("repeat: after a completed cycle (PROCESSED), the next online→offline→online fires again")
        void reconnectAfterCompletedCycle_firesAgain() {
            StatefulRepo repo = statefulTargeted();
            repo.set(row(DeviceOnlineDispatchStatus.PROCESSED));   // previous cycle finished

            service.onDeviceWentOffline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);

            service.onDeviceCameOnline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        }

        @Test
        @DisplayName("case-2 device eventually fires on its FIRST real reconnect (offline→online → online→offline → offline→online)")
        void case2Device_firesOnNextRealReconnect() {
            StatefulRepo repo = statefulTargeted();

            // first connect (offline→online): not a reconnect → nothing
            service.onDeviceCameOnline(machine());
            assertThat(repo.current()).isNull();

            // now it genuinely goes online→offline → ARMED
            service.onDeviceWentOffline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.ARMED);

            // and reconnects → NEW
            service.onDeviceCameOnline(machine());
            assertThat(repo.status()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        }
    }

    // ── fixtures ─────────────────────────────────────────────────────────────────────────

    /** Make the DEVICE_ONLINE gate pass via an explicit SPECIFIC assignment to schedule "s1". */
    private void stubTargeted() {
        lenient().when(scheduleRepository.findByTenantIdAndTriggerAndStatus(TENANT, ScriptScheduleTrigger.DEVICE_ONLINE, ScriptStatus.ACTIVE))
                .thenReturn(List.of(schedule("s1", ScheduleDeviceSelectionMode.SPECIFIC)));
        lenient().when(assignedRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                .thenReturn(List.of(assignment("s1")));
    }

    /** Gate passing + a stateful dispatch repo whose find returns the last saved row. */
    private StatefulRepo statefulTargeted() {
        stubTargeted();
        StatefulRepo repo = new StatefulRepo();
        lenient().when(dispatchRepository.findByTenantIdAndMachineId(TENANT, MACHINE))
                .thenAnswer(inv -> Optional.ofNullable(repo.current()));
        lenient().when(dispatchRepository.save(any(DeviceFirstOnlineDispatch.class)))
                .thenAnswer(inv -> { repo.set(inv.getArgument(0)); return repo.current(); });
        return repo;
    }

    /** Tiny in-memory holder standing in for the single per-machine sentinel row. */
    private static final class StatefulRepo {
        private DeviceFirstOnlineDispatch row;
        void set(DeviceFirstOnlineDispatch r) { this.row = r; }
        DeviceFirstOnlineDispatch current() { return row; }
        DeviceOnlineDispatchStatus status() { return row == null ? null : row.getStatus(); }
    }

    private static ScriptSchedule schedule(String id, ScheduleDeviceSelectionMode mode) {
        return ScriptSchedule.builder().id(id).tenantId(TENANT).selectionMode(mode).build();
    }

    private static ScriptScheduleMachineAssigned assignment(String scheduleId) {
        return ScriptScheduleMachineAssigned.builder()
                .tenantId(TENANT).machineId(MACHINE).scriptScheduleId(scheduleId).build();
    }

    private static DeviceFirstOnlineDispatch row(DeviceOnlineDispatchStatus status) {
        return DeviceFirstOnlineDispatch.builder()
                .id("row-1").tenantId(TENANT).machineId(MACHINE).status(status).build();
    }

    private static Machine machine() {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(MACHINE);
        return m;
    }
}
