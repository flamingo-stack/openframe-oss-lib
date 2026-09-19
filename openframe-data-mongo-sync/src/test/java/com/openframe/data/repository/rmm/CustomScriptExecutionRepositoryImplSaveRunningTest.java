package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.RunningExecutionRows;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CustomScriptExecutionRepositoryImplSaveRunningTest {

    private final MongoTemplate mongoTemplate = mock(MongoTemplate.class);
    private final CustomScriptExecutionRepositoryImpl repo = new CustomScriptExecutionRepositoryImpl(mongoTemplate);

    @Test
    @DisplayName("saveRunning: one RUNNING row per machine, all sharing tenant/executionId/scriptId/scheduleId and a single dispatchedAt; result-side fields null")
    void saveRunning_stampsRunningRowsPerMachine() {
        when(mongoTemplate.insertAll(any())).thenAnswer(inv -> inv.getArgument(0));
        Instant before = Instant.now().minus(Duration.ofSeconds(1));
        List<String> machines = List.of("m-1", "m-2", "m-3");

        repo.saveRunning(RunningExecutionRows.builder()
                .tenantId("tenant-1").executionId("exec-1").scriptId("script-1").scheduleId("sched-1")
                .machineIds(machines).privilegeLevel(PrivilegeLevel.ADMIN).timeoutSeconds(90)
                .initiatedBy("user-1").source(ExecutionSource.SCHEDULED)
                .build());

        List<ScriptExecution> rows = capturedRows();
        assertThat(rows).hasSize(3);
        assertThat(rows).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo("tenant-1");
            assertThat(r.getExecutionId()).isEqualTo("exec-1");
            assertThat(r.getScriptId()).isEqualTo("script-1");
            assertThat(r.getScheduleId()).isEqualTo("sched-1");
            assertThat(r.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
            assertThat(r.getTimeoutSeconds()).isEqualTo(90);
            assertThat(r.getInitiatedBy()).isEqualTo("user-1");
            assertThat(r.getSource()).isEqualTo(ExecutionSource.SCHEDULED);
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
            assertThat(r.getDispatchedAt()).isAfterOrEqualTo(before);
            assertThat(r.getStatusChangedAt()).isEqualTo(r.getDispatchedAt());
            // result-side fields must be null on a freshly-dispatched row
            assertThat(r.getFinishedAt()).isNull();
            assertThat(r.getExitCode()).isNull();
            assertThat(r.getStdout()).isNull();
            assertThat(r.getError()).isNull();
            // not a software run
            assertThat(r.getPackageName()).isNull();
            assertThat(r.getSoftwareAction()).isNull();
        });
        assertThat(rows).extracting(ScriptExecution::getMachineId).containsExactlyElementsOf(machines);
        // single dispatchedAt shared across the batch so a UI grouping by "fired at" lines up
        assertThat(rows).extracting(ScriptExecution::getDispatchedAt).containsOnly(rows.get(0).getDispatchedAt());
    }

    @Test
    @DisplayName("saveRunning: a software request stamps the package identity (manager/name/action) onto every row")
    void saveRunning_stampsSoftwareIdentity() {
        when(mongoTemplate.insertAll(any())).thenAnswer(inv -> inv.getArgument(0));

        repo.saveRunning(RunningExecutionRows.builder()
                .tenantId("tenant-1").executionId("exec-1").scriptId("__software__brew-update")
                .machineIds(List.of("m-1")).privilegeLevel(PrivilegeLevel.USER).timeoutSeconds(90)
                .initiatedBy("user-1").source(ExecutionSource.AI_ASSISTANT)
                .packageManager(PackageManagerType.BREW).packageName("google-chrome").softwareAction(SoftwareAction.UPDATE)
                .build());

        ScriptExecution row = capturedRows().get(0);
        assertThat(row.getPackageManager()).isEqualTo(PackageManagerType.BREW);
        assertThat(row.getPackageName()).isEqualTo("google-chrome");
        assertThat(row.getSoftwareAction()).isEqualTo(SoftwareAction.UPDATE);
    }

    @Test
    @DisplayName("saveRunning: no machines → nothing persisted (never hits insertAll with an empty batch)")
    void saveRunning_emptyMachines_noInsert() {
        List<ScriptExecution> result = repo.saveRunning(RunningExecutionRows.builder()
                .tenantId("tenant-1").executionId("exec-1").scriptId("script-1")
                .machineIds(List.of()).privilegeLevel(PrivilegeLevel.USER).source(ExecutionSource.MANUAL)
                .build());

        assertThat(result).isEmpty();
        verify(mongoTemplate, never()).insertAll(any());
    }

    @SuppressWarnings("unchecked")
    private List<ScriptExecution> capturedRows() {
        ArgumentCaptor<Collection<ScriptExecution>> captor = ArgumentCaptor.forClass(Collection.class);
        verify(mongoTemplate).insertAll(captor.capture());
        return new ArrayList<>(captor.getValue());
    }
}
