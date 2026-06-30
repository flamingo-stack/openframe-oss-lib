package com.openframe.data.integration.repository.rmm;

import com.openframe.data.document.rmm.CommandExecution;
import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.PrivilegeLevel;
import com.openframe.data.document.rmm.ScriptShell;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import com.openframe.data.repository.rmm.CommandExecutionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class CommandExecutionRepositoryIT extends BaseMongoIntegrationTest {

    private static final String TENANT_A = "tenant-a";
    private static final String EXEC_1 = "exec-1";
    private static final String EXEC_2 = "exec-2";

    @Autowired
    private CommandExecutionRepository repository;

    @Autowired
    private MongoTemplate mongoTemplate;

    @BeforeEach
    void resetCollection() {
        // Clear documents but keep indexes — dropCollection() would also drop the
        // compound unique index, and auto-index-creation runs only at startup.
        mongoTemplate.remove(new Query(), CommandExecution.class);
    }

    @Test
    @DisplayName("Given a RUNNING row, when persisted, then Mongo assigns an id and the row round-trips with its dispatch state")
    void save_assignsIdAndRoundTrips() {
        CommandExecution saved = repository.save(newRow("machine-1", EXEC_1));

        assertThat(saved.getId()).isNotBlank();
        assertThat(saved.getStatus()).isEqualTo(ExecutionStatus.RUNNING);
        assertThat(saved.getDispatchedAt()).isNotNull();
        assertThat(saved.getTenantId()).isEqualTo(TENANT_A);
    }

    @Test
    @DisplayName("Given rows for several machines under one execution, when findByMachineIdAndExecutionId targets one pair, then exactly that row is returned")
    void findByMachineIdAndExecutionId_returnsTheUniqueRow() {
        repository.save(newRow("machine-1", EXEC_1));
        repository.save(newRow("machine-2", EXEC_1));

        Optional<CommandExecution> hit = repository.findByMachineIdAndExecutionId("machine-1", EXEC_1);
        assertThat(hit).isPresent();
        assertThat(hit.get().getMachineId()).isEqualTo("machine-1");
        assertThat(hit.get().getExecutionId()).isEqualTo(EXEC_1);

        // Same machine, different execution → no row.
        assertThat(repository.findByMachineIdAndExecutionId("machine-1", EXEC_2)).isEmpty();
    }

    @Test
    @DisplayName("Given a batch fanned out to three machines (plus an unrelated execution), when findByExecutionId runs, then only that batch's three rows come back")
    void findByExecutionId_returnsAllRowsOfBatch() {
        repository.save(newRow("machine-1", EXEC_1));
        repository.save(newRow("machine-2", EXEC_1));
        repository.save(newRow("machine-3", EXEC_1));
        repository.save(newRow("machine-1", EXEC_2)); // different batch, must not leak

        List<CommandExecution> batch = repository.findByExecutionId(EXEC_1);

        assertThat(batch).hasSize(3)
                .extracting(CommandExecution::getMachineId)
                .containsExactlyInAnyOrder("machine-1", "machine-2", "machine-3");
        assertThat(batch).allSatisfy(r -> assertThat(r.getExecutionId()).isEqualTo(EXEC_1));
    }

    @Test
    @DisplayName("Given a row for (machine-1, exec-1), when another row with the same pair is saved, then Mongo rejects it (compound unique index)")
    void uniqueIndex_rejectsDuplicateMachineAndExecution() {
        repository.save(newRow("machine-1", EXEC_1));

        assertThatThrownBy(() -> repository.save(newRow("machine-1", EXEC_1)))
                .isInstanceOf(DuplicateKeyException.class);
    }

    @Test
    @DisplayName("Given (machine-1, exec-1), when saving (machine-1, exec-2) and (machine-2, exec-1), then both coexist — uniqueness is on the PAIR, not either field alone")
    void uniqueIndex_allowsDifferentPairs() {
        repository.save(newRow("machine-1", EXEC_1));

        CommandExecution sameMachineOtherExec = repository.save(newRow("machine-1", EXEC_2));
        CommandExecution otherMachineSameExec = repository.save(newRow("machine-2", EXEC_1));

        assertThat(sameMachineOtherExec.getId()).isNotBlank();
        assertThat(otherMachineSameExec.getId()).isNotBlank();
        assertThat(repository.findByExecutionId(EXEC_1)).hasSize(2);
    }

    private static CommandExecution newRow(String machineId, String executionId) {
        return CommandExecution.builder()
                .tenantId(TENANT_A)
                .executionId(executionId)
                .machineId(machineId)
                .command("uptime")
                .shell(ScriptShell.BASH)
                .privilegeLevel(PrivilegeLevel.ADMIN)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(java.time.Instant.now())
                .statusChangedAt(java.time.Instant.now())
                .build();
    }
}
