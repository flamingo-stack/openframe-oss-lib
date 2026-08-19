package com.openframe.data.repository.rmm;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CustomScriptExecutionRepositoryImplIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";
    private static final String MACHINE = "machine-1";
    private static final String EXEC = "exec-1";

    @Autowired
    private MongoTemplate mongoTemplate;

    @Autowired
    private ScriptExecutionRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(ScriptExecution.class);
    }

    private void saveLeaf(String executionId, String scriptId, ExecutionStatus status) {
        mongoTemplate.save(ScriptExecution.builder()
                .tenantId(TENANT)
                .executionId(executionId)
                .scriptId(scriptId)
                .machineId(MACHINE)
                .status(status)
                .dispatchedAt(Instant.now())
                .build());
    }

    @Test
    @DisplayName("result correlation: a fire's leaves share one executionId, and the lookup returns exactly the (machine, execution, script) leaf — not a sibling script's")
    void findByMachineIdAndExecutionIdAndScriptId_matchesTheRightLeaf() {
        saveLeaf(EXEC, "script-a", ExecutionStatus.SUCCESS);
        saveLeaf(EXEC, "script-b", ExecutionStatus.RUNNING);   // sibling script, same executionId

        assertThat(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, "script-b"))
                .get().extracting(ScriptExecution::getStatus).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, "script-a"))
                .get().extracting(ScriptExecution::getScriptId).isEqualTo("script-a");
        assertThat(repository.findByMachineIdAndExecutionIdAndScriptId(MACHINE, EXEC, "no-such-script"))
                .isEmpty();
        assertThat(repository.findByMachineIdAndExecutionIdAndScriptId("other-machine", EXEC, "script-a"))
                .isEmpty();
    }

    @Test
    @DisplayName("countLeavesByStatus: running/failed are counted from the real enum-valued status field, scoped to (tenant, execution)")
    void countLeavesByStatus_countsRunningAndFailed() {
        saveLeaf(EXEC, "script-a", ExecutionStatus.RUNNING);
        saveLeaf(EXEC, "script-b", ExecutionStatus.RUNNING);
        saveLeaf(EXEC, "script-c", ExecutionStatus.FAILED);
        saveLeaf(EXEC, "script-d", ExecutionStatus.SUCCESS);   // neither running nor failed
        saveLeaf("other-exec", "script-a", ExecutionStatus.RUNNING);   // different fire — must not leak in

        CustomScriptExecutionRepository.LeafStatusCounts counts = repository.countLeavesByStatus(TENANT, EXEC);

        assertThat(counts.running()).isEqualTo(2L);
        assertThat(counts.failed()).isEqualTo(1L);
    }

    @Test
    @DisplayName("countLeavesByStatus: all leaves terminal → running == 0 (the condition the aggregator needs to flip the header to a terminal status)")
    void countLeavesByStatus_allTerminal_runningZero() {
        saveLeaf(EXEC, "script-a", ExecutionStatus.SUCCESS);
        saveLeaf(EXEC, "script-b", ExecutionStatus.SUCCESS);

        CustomScriptExecutionRepository.LeafStatusCounts counts = repository.countLeavesByStatus(TENANT, EXEC);

        assertThat(counts.running()).isZero();
        assertThat(counts.failed()).isZero();
    }
}
