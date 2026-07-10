package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.schedule.CreateScriptScheduleInput;
import com.openframe.api.dto.rmm.schedule.ScriptScheduleResponse;
import com.openframe.api.dto.rmm.schedule.UpdateScriptScheduleInput;
import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptSchedule;
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
                .build();
    }

    public void updateEntity(ScriptSchedule existing, UpdateScriptScheduleInput input) {
        existing.setName(input.getName());
        existing.setDescription(input.getDescription());
        existing.setSupportedPlatforms(input.getSupportedPlatforms());
        existing.setScriptIds(input.getScriptIds());
    }

    public ScriptScheduleResponse toResponse(ScriptSchedule entity) {
        return ScriptScheduleResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .supportedPlatforms(mapPlatformsToResponse(entity.getSupportedPlatforms()))
                .scriptIds(entity.getScriptIds())
                .createdBy(entity.getCreatedBy())
                .status(entity.getStatus() != null ? entity.getStatus().name() : ScriptStatus.ACTIVE.name())
                .statusChangedAt(entity.getStatusChangedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    private List<String> mapPlatformsToResponse(List<ScriptPlatform> platforms) {
        if (platforms == null) {
            return null;
        }
        return platforms.stream().map(ScriptPlatform::name).toList();
    }
}
