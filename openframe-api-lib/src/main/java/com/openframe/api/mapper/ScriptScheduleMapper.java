package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScheduledScriptCustomParamsInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.data.document.rmm.ScheduleDeviceSelectionMode;
import com.openframe.data.document.rmm.ScheduleOfflineBehavior;
import com.openframe.data.document.rmm.OsType;
import com.openframe.data.document.rmm.ScheduledScriptCustomParams;
import com.openframe.data.document.rmm.ScriptSchedule;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import com.openframe.data.document.rmm.ScriptStatus;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Pure entity &harr; DTO mapping for script schedules. Mirrors {@link ScriptMapper};
 * GraphQL-specific concerns (cursor pagination, Relay envelope) live in
 * {@code GraphQLScriptScheduleMapper}.
 */
@Component
public class ScriptScheduleMapper {

    public ScriptSchedule toEntity(String tenantId, CreateScriptScheduleInput input) {
        return ScriptSchedule.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .supportedPlatforms(input.getSupportedPlatforms())
                .scriptIds(input.getScriptIds())
                .scriptCustomParams(toCustomParams(input.getScriptCustomParams()))
                .trigger(defaultTrigger(input.getTrigger()))
                .offlineBehavior(defaultOfflineBehavior(input.getOfflineBehavior()))
                .startAt(input.getStartAt())
                .repeat(input.getRepeat())
                .build();
    }

    public void updateEntity(ScriptSchedule existing, UpdateScriptScheduleInput input) {
        existing.setName(input.getName());
        existing.setDescription(input.getDescription());
        existing.setSupportedPlatforms(input.getSupportedPlatforms());
        existing.setScriptIds(input.getScriptIds());
        existing.setScriptCustomParams(toCustomParams(input.getScriptCustomParams()));
        existing.setTrigger(defaultTrigger(input.getTrigger()));
        existing.setOfflineBehavior(defaultOfflineBehavior(input.getOfflineBehavior()));
        existing.setSelectionMode(defaultSelectionMode(input.getSelectionMode()));
        existing.setStartAt(input.getStartAt());
        existing.setRepeat(input.getRepeat());
    }

    private static ScriptScheduleTrigger defaultTrigger(ScriptScheduleTrigger trigger) {
        return trigger != null ? trigger : ScriptScheduleTrigger.DATE_TIME;
    }

    private static ScheduleOfflineBehavior defaultOfflineBehavior(ScheduleOfflineBehavior behavior) {
        return behavior != null ? behavior : ScheduleOfflineBehavior.SKIP;
    }

    private static ScheduleDeviceSelectionMode defaultSelectionMode(ScheduleDeviceSelectionMode mode) {
        return mode != null ? mode : ScheduleDeviceSelectionMode.SPECIFIC;
    }

    public ScriptScheduleResponse toResponse(ScriptSchedule entity) {
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
                .offlineBehavior(defaultOfflineBehavior(entity.getOfflineBehavior()))
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

    private static List<ScheduledScriptCustomParams> toCustomParams(List<ScheduledScriptCustomParamsInput> input) {
        if (input == null) {
            return null;
        }
        return input.stream()
                .map(p -> ScheduledScriptCustomParams.builder()
                        .scriptId(p.getScriptId())
                        .args(p.getArgs())
                        .envVars(ScriptEnvVarMapper.toEntity(p.getEnvVars()))
                        .build())
                .toList();
    }
}
