package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionResult;
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
        mongoTemplate.dropCollection(SoftwareActionResult.class);
        mongoTemplate.dropCollection(ScriptExecution.class);
    }

    @Test
    @DisplayName("reconciles status and X/Y from device leaves, total from the action row")
    void reconcilesFromLeaves() {
        action("exec-1", 3, SoftwareActionStatus.IN_PROGRESS);
        leaf("exec-1", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-1", "m2", ExecutionStatus.SUCCESS);
        leaf("exec-1", "m3", ExecutionStatus.SUCCESS);

        action("exec-2", 2, SoftwareActionStatus.IN_PROGRESS);
        leaf("exec-2", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-2", "m2", ExecutionStatus.FAILED);

        action("exec-3", 2, SoftwareActionStatus.IN_PROGRESS);
        leaf("exec-3", "m1", ExecutionStatus.SUCCESS);
        leaf("exec-3", "m2", ExecutionStatus.QUEUED);

        assertThat(repository.count(TENANT, null, null)).isEqualTo(3);
        Map<String, SoftwareActionSummary> byExec = allRows();

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
    @DisplayName("a just-submitted NOW action with no leaves yet is visible immediately as IN_PROGRESS 0/Y")
    void immediateNowActionIsVisible() {
        action("exec-now", 5, SoftwareActionStatus.IN_PROGRESS);

        assertThat(repository.count(TENANT, null, null)).isEqualTo(1);
        SoftwareActionSummary row = allRows().get("exec-now");
        assertThat(row.getStatus()).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
        assertThat(row.getTotalMachineCount()).isEqualTo(5);
        assertThat(row.getRespondedMachineCount()).isEqualTo(0);
    }

    @Test
    @DisplayName("a scheduled action not yet fired is excluded (listed from live schedules, not here)")
    void scheduledNotYetFiredExcluded() {
        action("exec-sched", 2, SoftwareActionStatus.SCHEDULED);

        assertThat(repository.count(TENANT, null, null)).isZero();
        assertThat(repository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 50)).isEmpty();
    }

    @Test
    @DisplayName("a scheduled action becomes visible once it fires and leaves appear")
    void scheduledBecomesVisibleAfterFiring() {
        action("exec-sched2", 1, SoftwareActionStatus.SCHEDULED);
        leaf("exec-sched2", "m1", ExecutionStatus.SUCCESS);

        Map<String, SoftwareActionSummary> byExec = allRows();
        assertThat(byExec).containsKey("exec-sched2");
        assertThat(byExec.get("exec-sched2").getStatus()).isEqualTo(SoftwareActionStatus.COMPLETED);
        assertThat(byExec.get("exec-sched2").getRespondedMachineCount()).isEqualTo(1);
    }

    private Map<String, SoftwareActionSummary> allRows() {
        return repository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 50).stream()
                .collect(Collectors.toMap(SoftwareActionSummary::getExecutionId, Function.identity()));
    }

    private void action(String executionId, int totalMachineCount, SoftwareActionStatus status) {
        mongoTemplate.save(SoftwareActionResult.builder()
                .id(executionId)
                .tenantId(TENANT)
                .executionId(executionId)
                .action(SoftwareAction.INSTALL)
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .status(status)
                .totalMachineCount(totalMachineCount)
                .dispatchedAt(Instant.now())
                .initiatedBy("user-1")
                .build());
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
