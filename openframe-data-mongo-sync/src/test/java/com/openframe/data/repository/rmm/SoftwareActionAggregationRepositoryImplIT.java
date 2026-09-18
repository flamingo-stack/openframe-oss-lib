package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import com.openframe.data.document.rmm.software.SoftwareActionSummary;
import com.openframe.data.integration.BaseMongoIntegrationTest;
import com.openframe.data.integration.support.RmmIntegrationTestApplication;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.core.MongoTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(classes = RmmIntegrationTestApplication.class)
@Tag("integration")
@EnabledIfSystemProperty(named = "integration.tests", matches = "true")
class SoftwareActionAggregationRepositoryImplIT extends BaseMongoIntegrationTest {

    private static final String TENANT = "tenant-1";

    @Autowired private MongoTemplate mongoTemplate;
    @Autowired private SoftwareActionAggregationRepository repository;

    @BeforeEach
    void clean() {
        mongoTemplate.dropCollection(ScriptExecution.class);
    }

    @Test
    @DisplayName("groups software leaves by executionId, derives status and X/Y from device statuses")
    void aggregatesActions() {
        // exec-1: all done OK -> COMPLETED 3/3
        leaf("exec-1", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-1", "m2", ExecutionStatus.SUCCESS);
        leaf("exec-1", "m3", ExecutionStatus.SUCCESS);
        // exec-2: one failed -> FAILED 2/2
        leaf("exec-2", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-2", "m2", ExecutionStatus.FAILED);
        // exec-3: one still queued -> IN_PROGRESS 1/2
        leaf("exec-3", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-3", "m2", ExecutionStatus.QUEUED);

        assertThat(repository.count(TENANT, null, null)).isEqualTo(3);
        Map<String, SoftwareActionSummary> byExec = repository
                .findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 50).stream()
                .collect(Collectors.toMap(SoftwareActionSummary::getExecutionId, Function.identity()));

        assertThat(byExec.get("exec-1").getStatus()).isEqualTo(SoftwareActionStatus.COMPLETED);
        assertThat(byExec.get("exec-1").getTotalMachineCount()).isEqualTo(3);
        assertThat(byExec.get("exec-1").getRespondedMachineCount()).isEqualTo(3);

        assertThat(byExec.get("exec-2").getStatus()).isEqualTo(SoftwareActionStatus.FAILED);
        assertThat(byExec.get("exec-2").getRespondedMachineCount()).isEqualTo(2);

        assertThat(byExec.get("exec-3").getStatus()).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
        assertThat(byExec.get("exec-3").getTotalMachineCount()).isEqualTo(2);
        assertThat(byExec.get("exec-3").getRespondedMachineCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("non-software leaves (no softwareAction) are ignored")
    void ignoresNonSoftware() {
        leaf("exec-1", "m1", ExecutionStatus.SUCCESS);
        mongoTemplate.save(ScriptExecution.builder()
                .tenantId(TENANT).executionId("script-only").scriptId("s").machineId("m1")
                .status(ExecutionStatus.SUCCESS).dispatchedAt(Instant.now()).build());   // no softwareAction

        List<SoftwareActionSummary> rows = repository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 50);
        assertThat(rows).extracting(SoftwareActionSummary::getExecutionId).containsExactly("exec-1");
    }

    private void leaf(String executionId, String machineId, ExecutionStatus status) {
        mongoTemplate.save(ScriptExecution.builder()
                .tenantId(TENANT)
                .executionId(executionId)
                .scriptId("script-1")
                .machineId(machineId)
                .status(status)
                .softwareAction(SoftwareAction.INSTALL)
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .dispatchedAt(Instant.now())
                .initiatedBy("user-1")
                .build());
    }
}
