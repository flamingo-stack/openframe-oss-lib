package com.openframe.api.service.rmm;

import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CommandExecutionServiceTest {

    private static final String TENANT_ID = "t-1";
    private static final String EXECUTION_ID = "exec-1";

    @Mock
    private CommandExecutionRepository commandExecutionRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private CommandExecutionService service;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        service = new CommandExecutionService(commandExecutionRepository, tenantIdProvider);
    }

    @Test
    @DisplayName("createBatch: persists one RUNNING row per machine under a shared executionId — tenant-scoped, carrying command/shell/privilege/timeout/initiatedBy")
    void createBatch_persistsOneRunningRowPerMachine() {
        when(commandExecutionRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        service.createBatch(EXECUTION_ID, "uptime", ScriptShell.BASH, List.of("m-1", "m-2"),
                PrivilegeLevel.ADMIN, 30, "alice");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CommandExecution>> captor = ArgumentCaptor.forClass(List.class);
        verify(commandExecutionRepository).saveAll(captor.capture());
        List<CommandExecution> rows = captor.getValue();

        assertThat(rows).hasSize(2).allSatisfy(r -> {
            assertThat(r.getTenantId()).isEqualTo(TENANT_ID);
            assertThat(r.getExecutionId()).isEqualTo(EXECUTION_ID);
            assertThat(r.getCommand()).isEqualTo("uptime");
            assertThat(r.getShell()).isEqualTo(ScriptShell.BASH);
            assertThat(r.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
            assertThat(r.getTimeoutSeconds()).isEqualTo(30);
            assertThat(r.getInitiatedBy()).isEqualTo("alice");
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
            assertThat(r.getDispatchedAt()).isNotNull();
            assertThat(r.getStatusChangedAt()).isEqualTo(r.getDispatchedAt());
        });
        assertThat(rows).extracting(CommandExecution::getMachineId).containsExactlyInAnyOrder("m-1", "m-2");
    }

    @Test
    @DisplayName("getBatchResults: tenant-scoped per-machine lookup; machines with no row yet are omitted")
    void getBatchResults_readsExistingRowsOnly() {
        CommandExecution m1 = CommandExecution.builder()
                .machineId("m-1").executionId(EXECUTION_ID)
                .status(ExecutionStatus.SUCCESS).stdout("ok").build();
        when(commandExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, "m-1"))
                .thenReturn(Optional.of(m1));
        when(commandExecutionRepository.findByTenantIdAndExecutionIdAndMachineId(TENANT_ID, EXECUTION_ID, "m-2"))
                .thenReturn(Optional.empty());

        List<CommandExecution> results = service.getBatchResults(EXECUTION_ID, List.of("m-1", "m-2"));

        assertThat(results).singleElement().satisfies(r -> {
            assertThat(r.getMachineId()).isEqualTo("m-1");
            assertThat(r.getStdout()).isEqualTo("ok");
            assertThat(r.getStatus()).isEqualTo(ExecutionStatus.SUCCESS);
        });
    }
}
