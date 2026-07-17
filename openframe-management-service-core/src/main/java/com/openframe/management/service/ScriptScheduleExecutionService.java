package com.openframe.management.service;

import com.openframe.data.document.rmm.ExecutionStatus;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptExecution;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleMachineAssigned;
import com.openframe.data.document.rmm.ScriptStatus;
import com.openframe.data.nats.rmm.model.ScriptMessage;
import com.openframe.data.nats.rmm.publisher.ScriptNatsPublisher;
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
 * repositories and {@link ScriptNatsPublisher} directly rather than reusing the
 * api-lib dispatch service, which is request-scoped (GraphQL/tenant-from-principal)
 * and not on the management classpath.
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
 *       {@link ScriptMessage} and {@code scriptId} disambiguates each row/payload
 *       (correlation key: {@code executionId + machineId + scriptId}).</li>
 *   <li>Missed runs (runner was down / lock held past several intervals): the
 *       schedule fires <b>once</b> and {@code nextRunAt} is rolled forward to the
 *       next slot strictly after "now" — no backfill storm.</li>
 *   <li>A one-shot schedule ({@code repeatIntervalMinutes == null}) fires once
 *       and then has {@code nextRunAt} cleared to null.</li>
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
    private final ScriptNatsPublisher scriptNatsPublisher;

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

        // Preserve the schedule's stored run order.
        for (String scriptId : scriptIds) {
            Script script = byId.get(scriptId);
            if (script == null) {
                log.warn("Schedule scheduleId={} references missing/inactive scriptId={} — skipping",
                        schedule.getId(), scriptId);
                continue;
            }
            dispatchScript(schedule, executionId, script, machineIds, tenantId, now);
        }
    }

    private void dispatchScript(ScriptSchedule schedule, String executionId, Script script,
                                List<String> machineIds, String tenantId, Instant now) {
        Integer timeoutSeconds = script.getDefaultTimeoutSeconds();

        // Persist one RUNNING row per machine before publishing (mirrors the
        // api-lib dispatch path) so the watchdog can reap it if the agent never
        // responds.
        List<ScriptExecution> rows = machineIds.stream()
                .map(machineId -> ScriptExecution.builder()
                        .tenantId(tenantId)
                        .executionId(executionId)
                        .scriptId(script.getId())
                        .scheduleId(schedule.getId())
                        .machineId(machineId)
                        .privilegeLevel(script.getPrivilegeLevel())
                        .timeoutSeconds(timeoutSeconds)
                        .initiatedBy(schedule.getCreatedBy())
                        .status(ExecutionStatus.RUNNING)
                        .dispatchedAt(now)
                        .statusChangedAt(now)
                        .build())
                .toList();
        scriptExecutionRepository.saveAll(rows);

        // Fan the same script (one executionId, scheduleId stamped) out to every machine.
        machineIds.forEach(machineId -> scriptNatsPublisher.publishScript(machineId,
                ScriptMessage.builder()
                        .executionId(executionId)
                        .scheduleId(schedule.getId())
                        .scriptId(script.getId())
                        .machineId(machineId)
                        .code(script.getScriptBody())
                        .shell(script.getShell())
                        .privilegeLevel(script.getPrivilegeLevel())
                        .args(script.getDefaultArgs())
                        .timeoutSeconds(timeoutSeconds)
                        .envVars(script.getEnvVars())
                        .build()));

        log.info("Dispatched scheduled script scheduleId={} scriptId={} executionId={} machines={}",
                schedule.getId(), script.getId(), executionId, machineIds.size());
    }

    /**
     * Roll {@code nextRunAt} to the next slot strictly after {@code now}. One-shot
     * schedules (null/non-positive interval) are cleared to null. Skipping
     * multiple elapsed intervals collapses missed runs into a single next fire.
     */
    private void advanceNextRun(ScriptSchedule schedule, Instant now) {
        Integer intervalMinutes = schedule.getRepeatIntervalMinutes();
        if (intervalMinutes == null || intervalMinutes <= 0) {
            schedule.setNextRunAt(null);
            return;
        }
        Duration step = Duration.ofMinutes(intervalMinutes);
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
