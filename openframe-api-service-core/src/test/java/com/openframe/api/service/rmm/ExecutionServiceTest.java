package com.openframe.api.service.rmm;

import com.openframe.data.document.rmm.Execution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.api.mapper.ExecutionMapper;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.repository.rmm.ExecutionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ExecutionServiceTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String EXECUTION_ID = "exec-abc";
    private static final String SCRIPT_ID = "script-1";
    private static final String SCRIPT_NAME = "disk usage";
    private static final String MACHINE_ID = "machine-42";
    private static final String INITIATED_BY = "user-mr-anderson";

    @Mock
    private ExecutionRepository executionRepository;
    @Mock
    private TenantIdProvider tenantIdProvider;

    private ExecutionService service;

    @BeforeEach
    void setUp() {
        when(tenantIdProvider.getTenantId()).thenReturn(TENANT_ID);
        when(executionRepository.save(any(Execution.class))).thenAnswer(inv -> inv.getArgument(0));
        service = new ExecutionService(executionRepository, tenantIdProvider, new ExecutionMapper(),
                org.mockito.Mockito.mock(MongoTemplate.class));
    }

    @Test
    @DisplayName("create: persists a RUNNING Execution row with tenant scope + scriptName SNAPSHOT (so renames/deletes of the source Script don't erase History)")
    void create_persistsRunningRow() {
        Instant before = Instant.now().minus(Duration.ofSeconds(1));

        Execution result = service.create(EXECUTION_ID, SCRIPT_ID, SCRIPT_NAME, MACHINE_ID, PrivilegeLevel.ADMIN, INITIATED_BY);

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        Execution saved = captor.getValue();

        assertThat(saved.getTenantId()).isEqualTo(TENANT_ID);
        assertThat(saved.getExecutionId()).isEqualTo(EXECUTION_ID);
        assertThat(saved.getScriptId()).isEqualTo(SCRIPT_ID);
        assertThat(saved.getScriptName()).isEqualTo(SCRIPT_NAME);   // snapshot
        assertThat(saved.getMachineId()).isEqualTo(MACHINE_ID);
        assertThat(saved.getPrivilegeLevel()).isEqualTo(PrivilegeLevel.ADMIN);
        assertThat(saved.getInitiatedBy()).isEqualTo(INITIATED_BY);
        assertThat(saved.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
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
        service.create(EXECUTION_ID, SCRIPT_ID, SCRIPT_NAME, MACHINE_ID, PrivilegeLevel.USER, INITIATED_BY);

        verify(tenantIdProvider).getTenantId();
        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getTenantId()).isEqualTo(TENANT_ID);
    }

    @Test
    @DisplayName("create: a null initiatedBy is accepted and persisted as null — defensive fallback so an authenticated request without a fully-formed principal still produces a History row instead of NPE-ing the whole dispatch")
    void create_acceptsNullInitiatedBy() {
        service.create(EXECUTION_ID, SCRIPT_ID, SCRIPT_NAME, MACHINE_ID, PrivilegeLevel.ADMIN, null);

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getInitiatedBy()).isNull();
        assertThat(captor.getValue().getStatus()).isEqualTo(ExecutionStatus.RUNNING);
    }

    @Test
    @DisplayName("create: privilegeLevel is forwarded verbatim — USER vs ADMIN reaches the row exactly as the dispatch carried it")
    void create_forwardsPrivilegeLevelVerbatim() {
        service.create(EXECUTION_ID, SCRIPT_ID, SCRIPT_NAME, MACHINE_ID, PrivilegeLevel.USER, INITIATED_BY);

        ArgumentCaptor<Execution> captor = ArgumentCaptor.forClass(Execution.class);
        verify(executionRepository).save(captor.capture());
        assertThat(captor.getValue().getPrivilegeLevel()).isEqualTo(PrivilegeLevel.USER);
    }
}
