package com.openframe.api.service.rmm;

import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptExecutionStatus;
import com.openframe.api.mapper.ScriptExecutionMapper;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptExecutionServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-abc";
    private static final String SCRIPT_ID = "script-1";
    private static final String MACHINE_ID = "machine-42";
    private static final Integer TIMEOUT_SECONDS = 90;
    private static final String INITIATED_BY = "user-mr-anderson";

    @Mock
    private ScriptExecutionRepository scriptExecutionRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private ScriptExecutionService service;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        service = new ScriptExecutionService(scriptExecutionRepository, tenantIdProvider, new ScriptExecutionMapper());
    }

    @Test
    @DisplayName("create: persists a RUNNING Execution row with tenant scope + scriptId only (the display name is resolved at read time, NOT snapshotted on the row)")
    void create_persistsRunningRow() {
        when(scriptExecutionRepository.save(any(ScriptExecution.class))).thenAnswer(inv -> inv.getArgument(0));
        Instant before = Instant.now().minus(Duration.ofSeconds(1));

        ScriptExecution result = service.create(EXECUTION_ID, SCRIPT_ID, MACHINE_ID, PrivilegeLevel.ADMIN, TIMEOUT_SECONDS, INITIATED_BY);

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        ScriptExecution saved = captor.getValue();

        assertThat(saved.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(saved.getExecutionId()).isEqualTo(EXECUTION_ID);
        assertThat(saved.getScriptId()).isEqualTo(SCRIPT_ID);
        assertThat(saved.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(saved.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(saved.getTimeoutSeconds()).isEqualTo(TIMEOUT_SECONDS);   // persisted for the watchdog's per-execution threshold
        assertThat(saved.getInitiatedBy()).isEqualTo(INITIATED_BY);
        assertThat(saved.getStatus()).isEqualTo(ScriptExecutionStatus.RUNNING);
        assertThat(saved.getDispatchedAt()).isAfterOrEqualTo(before);
        assertThat(saved.getStatusChangedAt()).isEqualTo(saved.getDispatchedAt());

        // Result-side fields must be null on the freshly-dispatched row.
        assertThat(saved.getFinishedAt()).isNull();
        assertThat(saved.getExitCode()).isNull();
        assertThat(saved.getStdout()).isNull();
        assertThat(saved.getStderr()).isNull();
        assertThat(saved.getError()).isNull();

        // Service returns the persisted row (id assigned by Mongo on save).
        assertThat(result).isSameAs(saved);
    }

    @Test
    @DisplayName("create: tenantId is taken from TenantIdProvider, NOT from any caller-supplied input — locks in the pod-scoped tenant contract")
    void create_alwaysUsesTenantIdProvider() {
        service.create(EXECUTION_ID, SCRIPT_ID, MACHINE_ID, PrivilegeLevel.USER, TIMEOUT_SECONDS, INITIATED_BY);

        verify(tenantIdProvider).getTenantId();
        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("create: a null initiatedBy is accepted and persisted as null — defensive fallback so an authenticated request without a fully-formed principal still produces a History row instead of NPE-ing the whole dispatch")
    void create_acceptsNullInitiatedBy() {
        service.create(EXECUTION_ID, SCRIPT_ID, MACHINE_ID, PrivilegeLevel.ADMIN, TIMEOUT_SECONDS, null);

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getInitiatedBy()).isNull();
        assertThat(captor.getValue().getStatus()).isEqualTo(ScriptExecutionStatus.RUNNING);
    }

    @Test
    @DisplayName("create: privilegeLevel is forwarded verbatim — USER vs ADMIN reaches the row exactly as the dispatch carried it")
    void create_forwardsPrivilegeLevelVerbatim() {
        service.create(EXECUTION_ID, SCRIPT_ID, MACHINE_ID, PrivilegeLevel.USER, TIMEOUT_SECONDS, INITIATED_BY);

        ArgumentCaptor<ScriptExecution> captor = ArgumentCaptor.forClass(ScriptExecution.class);
        verify(scriptExecutionRepository).save(captor.capture());
        assertThat(captor.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }

    @Test
    @DisplayName("createBatch: persists one RUNNING row per machineId under a shared executionId — all rows share tenantId / scriptId / dispatchedAt, each row carries its own machineId. Backs (tenantId, executionId, machineId) unique constraint.")
    void createBatch_persistsOneRowPerMachine() {
        when(scriptExecutionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));
        List<String> machines = List.of("m-1", "m-2", "m-3");
        Instant before = Instant.now().minus(Duration.ofSeconds(1));

        service.createBatch(EXECUTION_ID, SCRIPT_ID, machines, PrivilegeLevel.ADMIN, TIMEOUT_SECONDS, INITIATED_BY);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ScriptExecution>> captor = ArgumentCaptor.forClass(List.class);
        verify(scriptExecutionRepository).saveAll(captor.capture());
        List<ScriptExecution> rows = captor.getValue();

        assertThat(rows).hasSize(3);
        assertThat(rows)
                .allSatisfy(r -> {
                    assertThat(r.getTenantId()).isEqualTo(TENANT_ID);
                    assertThat(r.getExecutionId()).isEqualTo(EXECUTION_ID);
                    assertThat(r.getScriptId()).isEqualTo(SCRIPT_ID);
                    assertThat(r.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
                    assertThat(r.getTimeoutSeconds()).isEqualTo(TIMEOUT_SECONDS);
                    assertThat(r.getInitiatedBy()).isEqualTo(INITIATED_BY);
                    assertThat(r.getStatus()).isEqualTo(ScriptExecutionStatus.RUNNING);
                    assertThat(r.getDispatchedAt()).isAfterOrEqualTo(before);
                })
                .extracting(ScriptExecution::getMachineId)
                .containsExactlyElementsOf(machines);

        // dispatchedAt is a single Instant captured once for the whole batch — same value across all rows
        // so a UI grouping by "batch fired at" lines up exactly.
        Instant sharedAt = rows.get(0).getDispatchedAt();
        assertThat(rows).extracting(ScriptExecution::getDispatchedAt).containsOnly(sharedAt);
    }
}
