package com.openframe.client.service;

import com.openframe.client.service.rmm.ScheduleFireDispatcher;
import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.schedule.DeviceFirstOnlineDispatch;
import com.openframe.data.document.rmm.schedule.DeviceOnlineDispatchStatus;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduleScriptExecution;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.script.ScriptShell;
import com.openframe.data.document.rmm.script.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.DeviceOnlineDispatchRepository;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.service.rmm.ScheduleDeviceTargetResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Locks the batch wire shape of one schedule fire: one executionId (shared across scripts +
 * machines), a header row, per-(script, machine) leaves persisted RUNNING before publish, and
 * ONE batched NATS message per machine. Plus the "nothing to dispatch" no-ops.
 */
@ExtendWith(MockitoExtension.class)
class ScheduleFireDispatcherTest {

    private static final String TENANT = "tenant-1";
    private static final String SCHEDULE_ID = "sched-1";
    private static final String OWNER = "user-1";

    @Mock private ScheduleDeviceTargetResolver targetResolver;
    @Mock private ScriptRepository scriptRepository;
    @Mock private ScriptExecutionRepository scriptExecutionRepository;
    @Mock private ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    @Mock private ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;
    @Mock private MachineRepository machineRepository;
    @Mock private DeviceOnlineDispatchRepository dispatchRepository;
    @Mock private com.openframe.client.service.rmm.ScriptDeliveryRetryStore retryStore;

    private ScheduleFireDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        dispatcher = new ScheduleFireDispatcher(targetResolver, scriptRepository,
                scriptExecutionRepository, scheduleScriptExecutionRepository, scriptScheduleNatsPublisher,
                machineRepository, dispatchRepository, retryStore);
    }

    @Test
    @DisplayName("dispatch: header persisted RUNNING, leaves per (script, machine), ONE batched message per machine")
    void dispatch_fansOutOneBatchPerMachine() {
        Instant now = Instant.now();
        ScheduleScript schedule = schedule(List.of("script-a", "script-b"));
        when(targetResolver.resolveTargetMachineIds(schedule)).thenReturn(List.of("m1", "m2"));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH), script("script-b", ScriptShell.POWERSHELL)));

        dispatcher.dispatch(schedule, now);

        // 1. Header row — RUNNING, snapshotting the run.
        ArgumentCaptor<ScheduleScriptExecution> headerCaptor = ArgumentCaptor.forClass(ScheduleScriptExecution.class);
        verify(scheduleScriptExecutionRepository).save(headerCaptor.capture());
        ScheduleScriptExecution header = headerCaptor.getValue();
        assertThat(header.getTenantId()).isEqualTo(TENANT);
        assertThat(header.getScheduleId()).isEqualTo(SCHEDULE_ID);
        assertThat(header.getInitiatedBy()).isEqualTo(OWNER);
        assertThat(header.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(header.getTotalMachineCount()).isEqualTo(2);   // 2 machines targeted → denominator of "X of Y" progress UI
        assertThat(header.getDispatchedAt()).isNotNull();
        String runExecutionId = header.getExecutionId();
        assertThat(runExecutionId).isNotBlank();

        // 2. Leaves: 2 scripts x 2 machines = 4 rows in one saveAll, all RUNNING, shared executionId + scheduleId.
        ArgumentCaptor<List<ScriptExecution>> rowsCaptor = ArgumentCaptor.forClass(List.class);
        verify(scriptExecutionRepository).saveAll(rowsCaptor.capture());
        List<ScriptExecution> allRows = rowsCaptor.getValue();
        assertThat(allRows).hasSize(4);
        assertThat(allRows).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo(TENANT);
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.QUEUED);
            assertThat(r.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(r.getDispatchedAt()).isNotNull();
            assertThat(r.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(r.getExecutionId()).isEqualTo(runExecutionId);
        });
        assertThat(allRows).extracting(ScriptExecution::getScriptId).containsExactlyInAnyOrder(
                "script-a", "script-a", "script-b", "script-b");

        // 3. Wire: ONE batched message per machine (2 machines → 2 publishes), each with BOTH scripts.
        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher, times(2)).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getAllValues()).allSatisfy(m -> {
            assertThat(m.getScheduleId()).isEqualTo(SCHEDULE_ID);
            assertThat(m.getExecutionId()).isEqualTo(runExecutionId);
            assertThat(m.getInitiatedBy()).isEqualTo(OWNER);
            assertThat(m.getScripts()).extracting(ScriptScheduleExecutionItem::getScriptId)
                    .containsExactly("script-a", "script-b");
        });
        assertThat(msgCaptor.getAllValues()).extracting(ScriptScheduleExecutionMessage::getMachineId)
                .containsExactlyInAnyOrder("m1", "m2");
    }

    @Test
    @DisplayName("dispatch: no scripts or no assigned devices → nothing persisted or published")
    void dispatch_noScriptsOrDevices_isNoOp() {
        when(targetResolver.resolveTargetMachineIds(any())).thenReturn(List.of());   // no devices

        dispatcher.dispatch(schedule(List.of("script-a")), Instant.now());

        verifyNoInteractions(scriptRepository, scriptExecutionRepository,
                scheduleScriptExecutionRepository, scriptScheduleNatsPublisher);
    }

    @Test
    @DisplayName("dispatch: all referenced scripts missing/inactive → resolved but nothing dispatched")
    void dispatch_noRunnableScripts_isNoOp() {
        when(targetResolver.resolveTargetMachineIds(any())).thenReturn(List.of("m1"));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of());   // none resolve

        dispatcher.dispatch(schedule(List.of("gone")), Instant.now());

        verify(scheduleScriptExecutionRepository, never()).save(any());
        verify(scriptExecutionRepository, never()).saveAll(any());
        verifyNoInteractions(scriptScheduleNatsPublisher);
    }

    @Test
    @DisplayName("dispatch: a combined '-Name value' defaultArg is tokenized into separate argv tokens on the wire")
    void dispatch_tokenizesCombinedArgs() {
        when(targetResolver.resolveTargetMachineIds(any())).thenReturn(List.of("m1"));
        Script withArgs = Script.builder()
                .id("script-a").tenantId(TENANT).name("script-a").shell(ScriptShell.POWERSHELL)
                .privilegeLevel(PrivilegeLevel.USER).scriptBody("param($Bucket)")
                .defaultArgs(List.of("-Bucket BGCSouthVancouverIsland"))
                .defaultTimeoutSeconds(120).status(ScriptStatus.ACTIVE).build();
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(withArgs));

        dispatcher.dispatch(schedule(List.of("script-a")), Instant.now());

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getValue().getScripts().get(0).getArgs())
                .containsExactly("-Bucket", "BGCSouthVancouverIsland");   // name no longer leaks into the value
    }

    @Test
    @DisplayName("dispatch(schedule, machineIds, now): fires to exactly the given machines, bypassing the assignment lookup (DEVICE_ONLINE path)")
    void dispatch_toSpecificMachines_bypassesAssignmentLookup() {
        ScheduleScript schedule = schedule(List.of("script-a"));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.POWERSHELL)));

        dispatcher.dispatch(schedule, List.of("m9"), Instant.now());

        verifyNoInteractions(targetResolver);   // caller supplied the machine; no reverse lookup
        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getValue().getMachineId()).isEqualTo("m9");
    }

    @Test
    @DisplayName("dispatch: per-script custom params override args + env for that script only; others keep their defaults")
    void dispatch_customParamsOverrideArgsAndEnv() {
        when(targetResolver.resolveTargetMachineIds(any())).thenReturn(List.of("m1"));
        Script scriptA = Script.builder()
                .id("script-a").tenantId(TENANT).name("script-a").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).scriptBody("echo a")
                .defaultArgs(List.of("--default"))
                .envVars(List.of(new ScriptEnvVar("BASE", "base-val", false)))
                .defaultTimeoutSeconds(120).status(ScriptStatus.ACTIVE).build();
        Script scriptB = script("script-b", ScriptShell.POWERSHELL);   // no custom params → defaults
        scriptB.setDefaultArgs(List.of("--b-default"));
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(scriptA, scriptB));

        ScheduleScript schedule = schedule(List.of("script-a", "script-b"));
        schedule.setScriptCustomParams(List.of(ScheduledScriptCustomParams.builder()
                .scriptId("script-a")
                .args(List.of("--custom", "42"))
                .envVars(List.of(new ScriptEnvVar("OVERRIDE", "custom-val", false)))
                .build()));

        dispatcher.dispatch(schedule, Instant.now());

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(anyString(), msgCaptor.capture());
        List<ScriptScheduleExecutionItem> items = msgCaptor.getValue().getScripts();

        ScriptScheduleExecutionItem a = items.stream().filter(i -> i.getScriptId().equals("script-a")).findFirst().orElseThrow();
        assertThat(a.getArgs()).containsExactly("--custom", "42");                 // override args win
        assertThat(a.getEnvVars()).extracting(ScriptEnvVar::getName).containsExactly("OVERRIDE");  // full replace, not merge
        assertThat(a.getEnvVars()).extracting(ScriptEnvVar::getName).doesNotContain("BASE");

        ScriptScheduleExecutionItem b = items.stream().filter(i -> i.getScriptId().equals("script-b")).findFirst().orElseThrow();
        assertThat(b.getArgs()).containsExactly("--b-default");                    // no custom params → stored default
    }

    @Test
    @DisplayName("dispatch: a custom-params entry with null args/env inherits the script's defaults for that dimension")
    void dispatch_customParamsNullFieldsInheritDefaults() {
        when(targetResolver.resolveTargetMachineIds(any())).thenReturn(List.of("m1"));
        Script scriptA = Script.builder()
                .id("script-a").tenantId(TENANT).name("script-a").shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.USER).scriptBody("echo a")
                .defaultArgs(List.of("--default"))
                .envVars(List.of(new ScriptEnvVar("BASE", "base-val", false)))
                .defaultTimeoutSeconds(120).status(ScriptStatus.ACTIVE).build();
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any())).thenReturn(List.of(scriptA));

        ScheduleScript schedule = schedule(List.of("script-a"));
        schedule.setScriptCustomParams(List.of(ScheduledScriptCustomParams.builder()
                .scriptId("script-a")
                .args(List.of("--custom"))   // args overridden; envVars null → inherit
                .envVars(null)
                .build()));

        dispatcher.dispatch(schedule, Instant.now());

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(anyString(), msgCaptor.capture());
        ScriptScheduleExecutionItem a = msgCaptor.getValue().getScripts().get(0);
        assertThat(a.getArgs()).containsExactly("--custom");
        assertThat(a.getEnvVars()).extracting(ScriptEnvVar::getName).containsExactly("BASE");   // inherited default env
    }

    @Test
    @DisplayName("dispatch RETRY_ON_RECONNECT: OFFLINE target is held (sentinel armed NEW + expiresAt), ONLINE target is dispatched")
    void dispatch_retryOnReconnect_armsOfflineDispatchesOnline() {
        Instant now = Instant.now();
        ScheduleScript schedule = retrySchedule(List.of("script-a"), 7200L);
        when(targetResolver.resolveTargetMachineIds(schedule)).thenReturn(List.of("m-online", "m-offline"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m-online", DeviceStatus.ONLINE), machine("m-offline", DeviceStatus.OFFLINE)));
        when(dispatchRepository.findByTenantIdAndMachineIdAndScheduleId(TENANT, "m-offline", SCHEDULE_ID))
                .thenReturn(Optional.empty());
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH)));

        dispatcher.dispatch(schedule, now);

        ArgumentCaptor<DeviceFirstOnlineDispatch> sentinelCaptor = ArgumentCaptor.forClass(DeviceFirstOnlineDispatch.class);
        verify(dispatchRepository).save(sentinelCaptor.capture());
        DeviceFirstOnlineDispatch sentinel = sentinelCaptor.getValue();
        assertThat(sentinel.getMachineId()).isEqualTo("m-offline");
        assertThat(sentinel.getScheduleId()).isEqualTo(SCHEDULE_ID);
        assertThat(sentinel.getStatus()).isEqualTo(DeviceOnlineDispatchStatus.NEW);
        assertThat(sentinel.getExpiresAt()).isEqualTo(now.plusSeconds(7200));

        ArgumentCaptor<ScriptScheduleExecutionMessage> msgCaptor =
                ArgumentCaptor.forClass(ScriptScheduleExecutionMessage.class);
        verify(scriptScheduleNatsPublisher).publish(anyString(), msgCaptor.capture());
        assertThat(msgCaptor.getValue().getMachineId()).isEqualTo("m-online");
        ArgumentCaptor<ScheduleScriptExecution> headerCaptor = ArgumentCaptor.forClass(ScheduleScriptExecution.class);
        verify(scheduleScriptExecutionRepository).save(headerCaptor.capture());
        assertThat(headerCaptor.getValue().getTotalMachineCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("dispatch RETRY_ON_RECONNECT: ALL targets OFFLINE → all armed, nothing published, no header")
    void dispatch_retryOnReconnect_allOffline_armsAllNoDispatch() {
        Instant now = Instant.now();
        ScheduleScript schedule = retrySchedule(List.of("script-a"), 3600L);
        when(targetResolver.resolveTargetMachineIds(schedule)).thenReturn(List.of("m1", "m2"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any()))
                .thenReturn(List.of(machine("m1", DeviceStatus.OFFLINE), machine("m2", DeviceStatus.OFFLINE)));
        when(dispatchRepository.findByTenantIdAndMachineIdAndScheduleId(eq(TENANT), anyString(), eq(SCHEDULE_ID)))
                .thenReturn(Optional.empty());

        dispatcher.dispatch(schedule, now);

        verify(dispatchRepository, times(2)).save(any(DeviceFirstOnlineDispatch.class));
        verify(scheduleScriptExecutionRepository, never()).save(any());   // no online target → no fire
        verifyNoInteractions(scriptScheduleNatsPublisher);
    }

    @Test
    @DisplayName("dispatch RETRY_ON_RECONNECT: a non-OFFLINE status (e.g. no Machine record) is dispatched, not held")
    void dispatch_retryOnReconnect_nonOfflineDispatched() {
        Instant now = Instant.now();
        ScheduleScript schedule = retrySchedule(List.of("script-a"), 3600L);
        when(targetResolver.resolveTargetMachineIds(schedule)).thenReturn(List.of("m-unknown"));
        when(machineRepository.findByTenantIdAndMachineIdIn(eq(TENANT), any())).thenReturn(List.of());  // no record
        when(scriptRepository.findByTenantIdAndIdIn(eq(TENANT), any()))
                .thenReturn(List.of(script("script-a", ScriptShell.BASH)));

        dispatcher.dispatch(schedule, now);

        verify(dispatchRepository, never()).save(any());                  // nothing armed
        verify(scriptScheduleNatsPublisher).publish(eq("m-unknown"), any());   // dispatched as-is
    }

    private static ScheduleScript schedule(List<String> scriptIds) {
        return ScheduleScript.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .createdBy(OWNER)
                .scriptIds(scriptIds)
                .build();
    }

    private static ScheduleScript retrySchedule(List<String> scriptIds, long windowSeconds) {
        return ScheduleScript.builder()
                .id(SCHEDULE_ID)
                .tenantId(TENANT)
                .name("sched")
                .status(ScriptStatus.ACTIVE)
                .createdBy(OWNER)
                .scriptIds(scriptIds)
                .trigger(ScheduleScriptTrigger.DATE_TIME)
                .offlineBehavior(ScheduleOfflineBehavior.RETRY_ON_RECONNECT)
                .reconnectWindowSeconds(windowSeconds)
                .build();
    }


    private static Script script(String id, ScriptShell shell) {
        return Script.builder()
                .id(id)
                .tenantId(TENANT)
                .name(id)
                .shell(shell)
                .privilegeLevel(PrivilegeLevel.USER)
                .scriptBody("echo " + id)
                .defaultTimeoutSeconds(120)
                .status(ScriptStatus.ACTIVE)
                .build();
    }

    private static Machine machine(String machineId, DeviceStatus status) {
        Machine m = new Machine();
        m.setTenantId(TENANT);
        m.setMachineId(machineId);
        m.setStatus(status);
        return m;
    }
}
