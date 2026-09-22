package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScheduledScriptCustomParamsInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.data.document.rmm.schedule.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.schedule.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.schedule.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.schedule.ScheduleScript;
import com.openframe.data.document.rmm.schedule.ScheduleScriptTrigger;
import com.openframe.data.document.rmm.schedule.ScheduleTimeReference;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Pure entity &harr; DTO mapping for script schedules. Mirrors {@link ScriptMapper};
 * GraphQL-specific concerns (cursor pagination, Relay envelope) live in
 * {@code GraphQLScriptScheduleMapper}.
 */
@Component
public class ScriptScheduleMapper {

    public ScheduleScript toEntity(String tenantId, CreateScriptScheduleInput input,
                                   Map<String, List<ScriptEnvVar>> scriptDefaultsByScriptId) {
        return ScheduleScript.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .supportedPlatforms(input.getSupportedPlatforms())
                .scriptIds(input.getScriptIds())
                .scriptCustomParams(toCustomParams(input.getScriptCustomParams(),
                        Map.of(), scriptDefaultsByScriptId))
                .trigger(defaultTrigger(input.getTrigger()))
                .timeReference(defaultTimeReference(input.getTimeReference()))
                .offlineBehavior(defaultOfflineBehavior(input.getOfflineBehavior()))
                .reconnectWindowSeconds(input.getReconnectWindowSeconds())
                .startAt(input.getStartAt())
                .repeat(input.getRepeat())
                .build();
    }

    public void updateEntity(ScheduleScript existing, UpdateScriptScheduleInput input,
                             Map<String, List<ScriptEnvVar>> scriptDefaultsByScriptId) {
        existing.setName(input.getName());
        existing.setDescription(input.getDescription());
        existing.setSupportedPlatforms(input.getSupportedPlatforms());
        existing.setScriptIds(input.getScriptIds());
        // update: the prior stored override wins over script defaults so a customized secret is kept.
        Map<String, List<ScriptEnvVar>> storedByScriptId = storedOverridesByScriptId(existing);
        existing.setScriptCustomParams(toCustomParams(input.getScriptCustomParams(),
                storedByScriptId, scriptDefaultsByScriptId));
        existing.setTrigger(defaultTrigger(input.getTrigger()));
        existing.setTimeReference(defaultTimeReference(input.getTimeReference()));
        existing.setOfflineBehavior(defaultOfflineBehavior(input.getOfflineBehavior()));
        existing.setReconnectWindowSeconds(input.getReconnectWindowSeconds());
        existing.setSelectionMode(defaultSelectionMode(input.getSelectionMode()));
        existing.setStartAt(input.getStartAt());
        existing.setRepeat(input.getRepeat());
    }

    private static ScheduleScriptTrigger defaultTrigger(ScheduleScriptTrigger trigger) {
        return trigger != null ? trigger : ScheduleScriptTrigger.DATE_TIME;
    }

    private static ScheduleTimeReference defaultTimeReference(ScheduleTimeReference timeReference) {
        return timeReference != null ? timeReference : ScheduleTimeReference.SERVER;
    }

    private static ScheduleOfflineBehavior defaultOfflineBehavior(ScheduleOfflineBehavior behavior) {
        return behavior != null ? behavior : ScheduleOfflineBehavior.SKIP;
    }

    private static ScheduleDeviceSelectionMode defaultSelectionMode(ScheduleDeviceSelectionMode mode) {
        return mode != null ? mode : ScheduleDeviceSelectionMode.SPECIFIC;
    }

    public ScriptScheduleResponse toResponse(ScheduleScript entity) {
        return ScriptScheduleResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .supportedPlatforms(entity.getSupportedPlatforms())
                .scriptIds(entity.getScriptIds())
                .scriptCustomParams(entity.getScriptCustomParams())
                .selectionMode(defaultSelectionMode(entity.getSelectionMode()))
                .deviceCriteria(entity.getDeviceCriteria())
                .trigger(defaultTrigger(entity.getTrigger()))
                .timeReference(defaultTimeReference(entity.getTimeReference()))
                .offlineBehavior(defaultOfflineBehavior(entity.getOfflineBehavior()))
                .reconnectWindowSeconds(entity.getReconnectWindowSeconds())
                .startAt(entity.getStartAt())
                .repeat(entity.getRepeat())
                .nextRunAt(entity.getNextRunAt())
                .lastRunAt(entity.getLastRunAt())
                .createdBy(entity.getCreatedBy())
                .status(entity.getStatus() != null ? entity.getStatus() : ScriptStatus.ACTIVE)
                .statusChangedAt(entity.getStatusChangedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private static List<ScheduledScriptCustomParams> toCustomParams(
            List<ScheduledScriptCustomParamsInput> input,
            Map<String, List<ScriptEnvVar>> storedOverridesByScriptId,
            Map<String, List<ScriptEnvVar>> scriptDefaultsByScriptId) {
        if (input == null) {
            return null;
        }
        return input.stream()
                .map(p -> buildCustomParam(p, storedOverridesByScriptId, scriptDefaultsByScriptId))
                .toList();
    }

    private static ScheduledScriptCustomParams buildCustomParam(
            ScheduledScriptCustomParamsInput p,
            Map<String, List<ScriptEnvVar>> storedOverridesByScriptId,
            Map<String, List<ScriptEnvVar>> scriptDefaultsByScriptId) {
        // Named locals — PMD's NoMethodCallAsArgument (OFJAVA-002) rejects inline builder args.
        String scriptId = p.getScriptId();
        List<ScriptEnvVar> stored = storedOverridesByScriptId.getOrDefault(scriptId, List.of());
        List<ScriptEnvVar> defaults = scriptDefaultsByScriptId.getOrDefault(scriptId, List.of());
        List<ScriptEnvVar> resolvedEnvVars = ScriptEnvVarMapper.toEntityResolvingSecrets(
                p.getEnvVars(), stored, defaults);
        List<String> args = p.getArgs();
        return ScheduledScriptCustomParams.builder()
                .scriptId(scriptId)
                .args(args)
                .envVars(resolvedEnvVars)
                .build();
    }

    private static Map<String, List<ScriptEnvVar>> storedOverridesByScriptId(ScheduleScript existing) {
        List<ScheduledScriptCustomParams> current = existing.getScriptCustomParams();
        if (current == null || current.isEmpty()) {
            return Map.of();
        }
        return current.stream()
                .filter(p -> p.getScriptId() != null && p.getEnvVars() != null)
                .collect(Collectors.toMap(
                        ScheduledScriptCustomParams::getScriptId,
                        ScheduledScriptCustomParams::getEnvVars,
                        (a, b) -> a));
    }
}
