package com.openframe.management.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.ScheduleScriptExecution;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionItem;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleExecutionNatsPublisher;
import com.openframe.data.repository.rmm.ScheduleScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptExecutionRepository;
import com.openframe.data.repository.rmm.ScriptRepository;
import com.openframe.data.repository.rmm.ScriptScheduleMachineAssignedRepository;
import com.openframe.data.repository.rmm.ScriptScheduleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Time-driven runner for RMM {@link ScriptSchedule}s. Fires every schedule whose
 * {@code nextRunAt} has come due, fanning each of its scripts out to every
 * assigned device over core NATS — the same wire contract as the ad-hoc
 * {@code runScheduleJobNow} mutation, but originated by the clock rather than a
 * user.
 *
 * <p>Lives in the management service (like the {@code ScriptExecutionWatchdog})
 * because that is where the scheduled/ShedLock machinery runs. It talks to the
 * repositories and {@link ScriptScheduleExecutionNatsPublisher} directly rather
 * than reusing the api-lib dispatch service, which is request-scoped
 * (GraphQL/tenant-from-principal) and not on the management classpath.
 *
 * <p>Tenancy: the sweep query is tenant-agnostic (mirrors the watchdog); each
 * due schedule carries its own {@code tenantId}, which is used verbatim for all
 * downstream reads (scripts, assignments) and writes (execution rows) so a run
 * stays within the owning tenant.
 *
 * <h2>Semantics</h2>
 * <ul>
 *   <li><b>One {@code executionId} per schedule run</b>, shared across every script
 *       and machine of that fire; {@code scheduleId} is stamped on every
 *       {@link ScriptScheduleExecutionMessage} and {@code scriptId} disambiguates
 *       each leaf row (correlation key: {@code executionId + machineId + scriptId}).</li>
 *   <li>Missed runs (runner was down / lock held past several intervals): the
 *       schedule fires <b>once</b> and {@code nextRunAt} is rolled forward to the
 *       next slot strictly after "now" — no backfill storm.</li>
 *   <li>A one-shot schedule ({@code repeat == null}) fires once and then has
 *       {@code nextRunAt} cleared to null.</li>
 *   <li>A schedule with no scripts or no assigned devices still advances its
 *       {@code nextRunAt} (nothing is dispatched) so it does not hot-loop.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class ScriptScheduleExecutionService {

    private final ScriptScheduleRepository scheduleRepository;
    private final ScriptScheduleMachineAssignedRepository assignedRepository;
    private final ScriptRepository scriptRepository;
    private final ScriptExecutionRepository scriptExecutionRepository;
    private final ScheduleScriptExecutionRepository scheduleScriptExecutionRepository;
    private final ScriptScheduleExecutionNatsPublisher scriptScheduleExecutionNatsPublisher;

    /**
     * Fire every ACTIVE schedule that is due (nextRunAt &le; now). Each schedule
     * is handled independently: a failure on one is logged and its
     * {@code nextRunAt} still advanced, so one broken schedule cannot wedge the
     * sweep or hot-loop.
     */
    public void runDueSchedules() {
        Instant now = Instant.now();
        List<ScriptSchedule> due = scheduleRepository.findByStatusAndNextRunAtLessThanEqual(ScriptStatus.ACTIVE, now);
        if (due.isEmpty()) {
            log.debug("No due script schedules");
            return;
        }

        log.info("Found {} due script schedule(s) — running", due.size());
        for (ScriptSchedule schedule : due) {
            try {
                fire(schedule, now);
            } catch (Exception e) {
                log.error("Script schedule run failed scheduleId={} tenantId={} — advancing nextRunAt anyway",
                        schedule.getId(), schedule.getTenantId(), e);
                advanceNextRun(schedule, now);
                scheduleRepository.save(schedule);
            }
        }
    }

    private void fire(ScriptSchedule schedule, Instant now) {
        String tenantId = schedule.getTenantId();
        List<String> scriptIds = schedule.getScriptIds();
        List<String> machineIds = resolveMachineIds(tenantId, schedule.getId());

        if (scriptIds == null || scriptIds.isEmpty() || machineIds.isEmpty()) {
            log.info("Schedule scheduleId={} has no scripts or no assigned devices — nothing dispatched",
                    schedule.getId());
        } else {
            // One executionId for the entire run: shared across all scripts and machines.
            String executionId = UUID.randomUUID().toString();
            dispatchScripts(schedule, executionId, tenantId, scriptIds, machineIds, now);
        }

        schedule.setLastRunAt(now);
        advanceNextRun(schedule, now);
        scheduleRepository.save(schedule);
    }

    private void dispatchScripts(ScriptSchedule schedule, String executionId, String tenantId,
                                 List<String> scriptIds, List<String> machineIds, Instant now) {
        // Resolve all referenced scripts once; only ACTIVE scripts are dispatched.
        Map<String, Script> byId = scriptRepository.findByTenantIdAndIdIn(tenantId, scriptIds).stream()
                .filter(s -> s.getStatus() == ScriptStatus.ACTIVE)
                .collect(Collectors.toMap(Script::getId, Function.identity(), (a, b) -> a));

        // Preserve the schedule's stored run order; dedup and drop missing/inactive.
        List<Script> runnableScripts = scriptIds.stream().distinct()
                .map(byId::get).filter(Objects::nonNull).toList();
        if (runnableScripts.isEmpty()) {
            log.warn("Schedule scheduleId={} has no runnable scripts (all missing/inactive) — nothing dispatched",
                    schedule.getId());
            return;
        }
        List<String> runnableScriptIds = runnableScripts.stream().map(Script::getId).toList();

        // 1. Header — one ScheduleScriptExecution row per fire, snapshot of what was attempted.
        scheduleScriptExecutionRepository.save(ScheduleScriptExecution.builder()
                .tenantId(tenantId)
                .executionId(executionId)
                .scheduleId(schedule.getId())
                .initiatedBy(schedule.getCreatedBy())
                .scriptIds(runnableScriptIds)
                .machineIds(machineIds)
                .status(ExecutionStatus.RUNNING)
                .dispatchedAt(now)
                .build());

        // 2. Leaves — one ScriptExecution row per (script, machine); mirrors api-lib and
        //    keeps the watchdog + per-(script, machine) history working as before.
        List<ScriptExecution> rows = runnableScripts.stream()
                .flatMap(script -> machineIds.stream().map(machineId -> ScriptExecution.builder()
                        .tenantId(tenantId)
                        .executionId(executionId)
                        .scriptId(script.getId())
                        .scheduleId(schedule.getId())
                        .machineId(machineId)
                        .privilegeLevel(script.getPrivilegeLevel())
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .initiatedBy(schedule.getCreatedBy())
                        .status(ExecutionStatus.RUNNING)
                        .dispatchedAt(now)
                        .statusChangedAt(now)
                        .build()))
                .toList();
        scriptExecutionRepository.saveAll(rows);

        // 3. Wire payload — batched once, shared across every target machine.
        List<ScriptScheduleExecutionItem> scheduledScripts = runnableScripts.stream()
                .map(script -> ScriptScheduleExecutionItem.builder()
                        .scriptId(script.getId())
                        .code(script.getScriptBody())
                        .shell(script.getShell())
                        .privilegeLevel(script.getPrivilegeLevel())
                        .args(script.getDefaultArgs())
                        .timeoutSeconds(script.getDefaultTimeoutSeconds())
                        .envVars(script.getEnvVars())
                        .build())
                .toList();

        // 4. Fan out: ONE message per machine on machine.{machineId}.script-schedule-execution.
        machineIds.forEach(machineId -> scriptScheduleExecutionNatsPublisher.publish(machineId,
                ScriptScheduleExecutionMessage.builder()
                        .executionId(executionId)
                        .scheduleId(schedule.getId())
                        .machineId(machineId)
                        .initiatedBy(schedule.getCreatedBy())
                        .scripts(scheduledScripts)
                        .build()));

        log.info("Dispatched schedule fire scheduleId={} executionId={} scripts={} machines={}",
                schedule.getId(), executionId, runnableScripts.size(), machineIds.size());
    }

    /**
     * Roll {@code nextRunAt} to the next slot strictly after {@code now}. One-shot
     * schedules (null/non-positive interval) are cleared to null. Skipping
     * multiple elapsed intervals collapses missed runs into a single next fire.
     */
    private void advanceNextRun(ScriptSchedule schedule, Instant now) {
        Long repeatSeconds = schedule.getRepeat();
        if (repeatSeconds == null || repeatSeconds <= 0) {
            schedule.setNextRunAt(null);
            return;
        }
        Duration step = Duration.ofSeconds(repeatSeconds);
        Instant next = schedule.getNextRunAt() != null ? schedule.getNextRunAt() : now;
        while (!next.isAfter(now)) {
            next = next.plus(step);
        }
        schedule.setNextRunAt(next);
    }

    private List<String> resolveMachineIds(String tenantId, String scheduleId) {
        return assignedRepository.findByTenantIdAndScriptScheduleIdsContaining(tenantId, scheduleId)
                .map(ScriptScheduleMachineAssigned::getMachineIds)
                .filter(Objects::nonNull)
                .orElseGet(List::of);
    }
}
