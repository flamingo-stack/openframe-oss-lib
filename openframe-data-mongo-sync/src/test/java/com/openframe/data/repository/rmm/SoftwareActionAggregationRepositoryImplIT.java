package com.openframe.data.repository.rmm;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.filter.SoftwareActionQueryFilter;
import com.openframe.data.document.rmm.script.ExecutionStatus;
import com.openframe.data.document.rmm.script.ScriptExecution;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionKind;
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
    private static final Instant T0 = Instant.parse("2026-10-28T23:30:00Z");

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

    @Test
    @DisplayName("a waiting device makes the action WAITING and counts in waitingMachineCount")
    void waitingDevices() {
        action("exec-wait", 3, SoftwareActionStatus.IN_PROGRESS);
        leaf("exec-wait", "m1", ExecutionStatus.SUCCESS);
        waitingLeaf("exec-wait", "m2");
        leaf("exec-wait", "m3", ExecutionStatus.RUNNING);

        action("exec-run", 1, SoftwareActionStatus.IN_PROGRESS);
        leaf("exec-run", "m1", ExecutionStatus.RUNNING);

        Map<String, SoftwareActionSummary> byExec = allRows();
        assertThat(byExec.get("exec-wait").getStatus()).isEqualTo(SoftwareActionStatus.WAITING);
        assertThat(byExec.get("exec-wait").getWaitingMachineCount()).isEqualTo(1);
        assertThat(byExec.get("exec-wait").getRespondedMachineCount()).isEqualTo(1);
        assertThat(byExec.get("exec-run").getStatus()).isEqualTo(SoftwareActionStatus.IN_PROGRESS);
        assertThat(byExec.get("exec-run").getWaitingMachineCount()).isZero();

        SoftwareActionQueryFilter waitingOnly = SoftwareActionQueryFilter.builder()
                .statuses(List.of(SoftwareActionStatus.WAITING)).build();
        assertThat(repository.count(TENANT, waitingOnly, null)).isEqualTo(1);
        assertThat(repository.facet(TENANT, null, null, "status"))
                .containsEntry("WAITING", 1).containsEntry("IN_PROGRESS", 1);
    }

    @Test
    @DisplayName("the action's version comes through on the row")
    void versionIsProjected() {
        mongoTemplate.save(SoftwareActionResult.builder()
                .id("exec-v").tenantId(TENANT).executionId("exec-v")
                .action(SoftwareAction.INSTALL).packageManager(PackageManagerType.BREW).packageName("slack")
                .version("4.36.140").status(SoftwareActionStatus.IN_PROGRESS).totalMachineCount(1)
                .dispatchedAt(Instant.now()).build());

        assertThat(repository.findByExecutionId(TENANT, "exec-v").orElseThrow().getVersion()).isEqualTo("4.36.140");
    }

    @Test
    @DisplayName("kind: stored on the row, or its action's name on a row written before the kind existed; filter and facet use it")
    void kindFallsBackToActionAndFilters() {
        kindRow("exec-old-install", SoftwareAction.INSTALL, null);
        kindRow("exec-old-update", SoftwareAction.UPDATE, null);
        kindRow("exec-update", SoftwareAction.UPDATE, SoftwareActionKind.UPDATE);
        kindRow("exec-auto", SoftwareAction.UPDATE, SoftwareActionKind.AUTO_UPDATE);

        Map<String, SoftwareActionSummary> byExec = allRows();
        assertThat(byExec.get("exec-old-install").getKind()).isEqualTo(SoftwareActionKind.INSTALL);
        assertThat(byExec.get("exec-old-update").getKind()).isEqualTo(SoftwareActionKind.UPDATE);
        assertThat(byExec.get("exec-auto").getKind()).isEqualTo(SoftwareActionKind.AUTO_UPDATE);

        SoftwareActionQueryFilter updates = SoftwareActionQueryFilter.builder()
                .kinds(List.of(SoftwareActionKind.UPDATE)).build();
        assertThat(repository.findPage(TENANT, updates, null, "dispatchedAt", Sort.Direction.DESC, 0, 50))
                .extracting(SoftwareActionSummary::getExecutionId)
                .containsExactlyInAnyOrder("exec-old-update", "exec-update");

        SoftwareActionQueryFilter autoUpdates = SoftwareActionQueryFilter.builder()
                .kinds(List.of(SoftwareActionKind.AUTO_UPDATE)).build();
        assertThat(repository.count(TENANT, autoUpdates, null)).isEqualTo(1);

        assertThat(repository.facet(TENANT, null, null, "kind"))
                .containsEntry("INSTALL", 1).containsEntry("UPDATE", 2).containsEntry("AUTO_UPDATE", 1);
    }

    @Test
    @DisplayName("finishedAt: the last device's finish once every device is done, null until then")
    void finishedAtIsTheLastDevicesFinish() {
        action("exec-done", 2, SoftwareActionStatus.IN_PROGRESS);
        timedLeaf("exec-done", "m1", ExecutionStatus.SUCCESS, T0, T0.plusSeconds(60));
        timedLeaf("exec-done", "m2", ExecutionStatus.FAILED, T0, T0.plusSeconds(120));

        action("exec-running", 2, SoftwareActionStatus.IN_PROGRESS);
        timedLeaf("exec-running", "m1", ExecutionStatus.SUCCESS, T0, T0.plusSeconds(60));
        leaf("exec-running", "m2", ExecutionStatus.RUNNING);

        action("exec-waiting", 2, SoftwareActionStatus.IN_PROGRESS);
        timedLeaf("exec-waiting", "m1", ExecutionStatus.SUCCESS, T0, T0.plusSeconds(60));
        waitingLeaf("exec-waiting", "m2");

        action("exec-no-leaves", 1, SoftwareActionStatus.IN_PROGRESS);

        Map<String, SoftwareActionSummary> byExec = allRows();
        assertThat(byExec.get("exec-done").getFinishedAt()).isEqualTo(T0.plusSeconds(120));
        assertThat(byExec.get("exec-running").getFinishedAt()).isNull();
        assertThat(byExec.get("exec-waiting").getFinishedAt()).isNull();
        assertThat(byExec.get("exec-no-leaves").getFinishedAt()).isNull();
        assertThat(repository.findByExecutionId(TENANT, "exec-done").orElseThrow().getFinishedAt())
                .isEqualTo(T0.plusSeconds(120));
    }

    @Test
    @DisplayName("dispatchedAt: a fired schedule's row takes the first device's dispatch and sorts by it; a NOW row keeps its own")
    void dispatchedAtOfAFiredSchedule() {
        firedScheduleRow("exec-sched");
        timedLeaf("exec-sched", "m1", ExecutionStatus.SUCCESS, T0.plusSeconds(600), T0.plusSeconds(700));
        timedLeaf("exec-sched", "m2", ExecutionStatus.SUCCESS, T0.plusSeconds(300), T0.plusSeconds(400));

        nowRow("exec-older", T0);
        timedLeaf("exec-older", "m1", ExecutionStatus.SUCCESS, T0.plusSeconds(5), T0.plusSeconds(10));

        nowRow("exec-newer", T0.plusSeconds(900));

        assertThat(repository.findByExecutionId(TENANT, "exec-sched").orElseThrow().getDispatchedAt())
                .isEqualTo(T0.plusSeconds(300));
        assertThat(repository.findByExecutionId(TENANT, "exec-older").orElseThrow().getDispatchedAt()).isEqualTo(T0);
        assertThat(repository.findPage(TENANT, null, null, "dispatchedAt", Sort.Direction.DESC, 0, 50))
                .extracting(SoftwareActionSummary::getExecutionId)
                .containsExactly("exec-newer", "exec-sched", "exec-older");
    }

    private void firedScheduleRow(String executionId) {
        mongoTemplate.save(SoftwareActionResult.builder()
                .id(executionId).tenantId(TENANT).executionId(executionId)
                .action(SoftwareAction.UPDATE).packageManager(PackageManagerType.BREW).packageName("slack")
                .status(SoftwareActionStatus.SCHEDULED).totalMachineCount(2)
                .scheduleId("schedule-1").scheduledAt(T0).build());
    }

    private void nowRow(String executionId, Instant dispatchedAt) {
        mongoTemplate.save(SoftwareActionResult.builder()
                .id(executionId).tenantId(TENANT).executionId(executionId)
                .action(SoftwareAction.UPDATE).packageManager(PackageManagerType.BREW).packageName("slack")
                .status(SoftwareActionStatus.IN_PROGRESS).totalMachineCount(1)
                .dispatchedAt(dispatchedAt).build());
    }

    private void kindRow(String executionId, SoftwareAction action, SoftwareActionKind kind) {
        mongoTemplate.save(SoftwareActionResult.builder()
                .id(executionId).tenantId(TENANT).executionId(executionId)
                .action(action).kind(kind).packageManager(PackageManagerType.BREW).packageName("slack")
                .status(SoftwareActionStatus.IN_PROGRESS).totalMachineCount(1)
                .dispatchedAt(Instant.now()).build());
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

    private void timedLeaf(String executionId, String machineId, ExecutionStatus status, Instant dispatchedAt, Instant finishedAt) {
        mongoTemplate.save(ScriptExecution.builder()
                .tenantId(TENANT)
                .executionId(executionId)
                .scriptId("script-1")
                .machineId(machineId)
                .status(status)
                .softwareAction(SoftwareAction.UPDATE)
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .dispatchedAt(dispatchedAt)
                .finishedAt(finishedAt)
                .initiatedBy("user-1")
                .build());
    }

    private void waitingLeaf(String executionId, String machineId) {
        leaf(executionId, machineId, ExecutionStatus.RUNNING, true);
    }

    private void leaf(String executionId, String machineId, ExecutionStatus status) {
        leaf(executionId, machineId, status, null);
    }

    private void leaf(String executionId, String machineId, ExecutionStatus status, Boolean waiting) {
        mongoTemplate.save(ScriptExecution.builder()
                .tenantId(TENANT)
                .executionId(executionId)
                .scriptId("script-1")
                .machineId(machineId)
                .status(status)
                .waiting(waiting)
                .softwareAction(SoftwareAction.INSTALL)
                .packageManager(PackageManagerType.BREW)
                .packageName("slack")
                .dispatchedAt(Instant.now())
                .initiatedBy("user-1")
                .build());
    }
}
