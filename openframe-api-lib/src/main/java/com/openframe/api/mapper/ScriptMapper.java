package com.openframe.api.mapper;

import com.openframe.api.dto.rmm.script.CreateScriptInput;
import com.openframe.api.dto.rmm.script.ScriptEnvVarInput;
import com.openframe.api.dto.rmm.script.ScriptResponse;
import com.openframe.api.dto.rmm.script.UpdateScriptInput;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.script.Script;
import com.openframe.data.document.rmm.script.ScriptEnvVar;
import com.openframe.data.document.rmm.script.ScriptStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ScriptMapper {

    @Value("${openframe.rmm.test-mode.enabled}")
    private boolean testModeEnabled;

    public Script toEntity(String tenantId, CreateScriptInput input) {
        return Script.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .shell(input.getShell())
                .privilegeLevel(input.getPrivilegeLevel())
                .scriptBody(input.getScriptBody())
                .supportedPlatforms(input.getSupportedPlatforms())
                .defaultTimeoutSeconds(input.getDefaultTimeoutSeconds())
                .defaultArgs(input.getDefaultArgs())
                .envVars(ScriptEnvVarMapper.toEntity(input.getEnvVars()))
                .testScript(testModeEnabled)
                .build();
    }

    public void updateEntity(Script existing, UpdateScriptInput input) {
        existing.setName(input.getName());
        existing.setDescription(input.getDescription());
        existing.setShell(input.getShell());
        existing.setPrivilegeLevel(input.getPrivilegeLevel());
        existing.setScriptBody(input.getScriptBody());
        existing.setSupportedPlatforms(input.getSupportedPlatforms());
        existing.setDefaultTimeoutSeconds(input.getDefaultTimeoutSeconds());
        existing.setDefaultArgs(input.getDefaultArgs());
        existing.setEnvVars(ScriptEnvVarMapper.toEntity(input.getEnvVars()));
    }

    public ScriptResponse toResponse(Script entity) {
        return ScriptResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .shell(entity.getShell())
                .privilegeLevel(entity.getPrivilegeLevel() != null ? entity.getPrivilegeLevel() : PrivilegeLevel.USER)
                .scriptBody(entity.getScriptBody())
                .supportedPlatforms(entity.getSupportedPlatforms())
                .defaultTimeoutSeconds(entity.getDefaultTimeoutSeconds())
                .defaultArgs(entity.getDefaultArgs())
                .envVars(mapEnvVarsToResponse(entity.getEnvVars()))
                .createdBy(entity.getCreatedBy())
                .status(entity.getStatus() != null ? entity.getStatus() : ScriptStatus.ACTIVE)
                .statusChangedAt(entity.getStatusChangedAt())
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .testScript(entity.isTestScript())
                .build();
    }

    private List<ScriptEnvVarInput> mapEnvVarsToResponse(List<ScriptEnvVar> envVars) {
        if (envVars == null) {
            return null;
        }
        return envVars.stream()
                .map(v -> ScriptEnvVarInput.builder()
                        .name(v.getName())
                        // TODO: mask value when secret == true once secret-management lands.
                        .value(v.getValue())
                        .secret(v.isSecret())
                        .build())
                .toList();
    }

}
