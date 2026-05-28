package com.openframe.api.mapper;

import com.openframe.api.dto.GenericConnection;
import com.openframe.api.dto.GenericEdge;
import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.script.CreateScriptInput;
import com.openframe.api.dto.script.ScriptEnvVarDto;
import com.openframe.api.dto.script.ScriptResponse;
import com.openframe.api.dto.script.UpdateScriptInput;
import com.openframe.api.dto.shared.ConnectionArgs;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.data.document.rmm.Script;
import com.openframe.data.document.rmm.ScriptEnvVar;
import com.openframe.data.document.rmm.ScriptPlatform;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class ScriptMapper {

    public Script toEntity(String tenantId, CreateScriptInput input) {
        return Script.builder()
                .tenantId(tenantId)
                .name(input.getName())
                .description(input.getDescription())
                .shell(input.getShell())
                .scriptBody(input.getScriptBody())
                .tag(input.getTag())
                .supportedPlatforms(input.getSupportedPlatforms())
                .defaultTimeoutSeconds(input.getDefaultTimeoutSeconds())
                .defaultArgs(input.getDefaultArgs())
                .envVars(mapEnvVarsToEntity(input.getEnvVars()))
                .build();
    }

    /**
     * Apply non-null fields from {@code input} onto {@code existing}. List
     * fields are replaced wholesale (not merged) when present — supplying an
     * empty list explicitly clears them, supplying {@code null} leaves them
     * untouched.
     */
    public void updateEntity(Script existing, UpdateScriptInput input) {
        if (input.getName() != null) {
            existing.setName(input.getName());
        }
        if (input.getDescription() != null) {
            existing.setDescription(input.getDescription());
        }
        if (input.getShell() != null) {
            existing.setShell(input.getShell());
        }
        if (input.getScriptBody() != null) {
            existing.setScriptBody(input.getScriptBody());
        }
        if (input.getTag() != null) {
            existing.setTag(input.getTag());
        }
        if (input.getSupportedPlatforms() != null) {
            existing.setSupportedPlatforms(input.getSupportedPlatforms());
        }
        if (input.getDefaultTimeoutSeconds() != null) {
            existing.setDefaultTimeoutSeconds(input.getDefaultTimeoutSeconds());
        }
        if (input.getDefaultArgs() != null) {
            existing.setDefaultArgs(input.getDefaultArgs());
        }
        if (input.getEnvVars() != null) {
            existing.setEnvVars(mapEnvVarsToEntity(input.getEnvVars()));
        }
    }

    public ScriptResponse toResponse(Script entity) {
        return ScriptResponse.builder()
                .id(entity.getId())
                .name(entity.getName())
                .description(entity.getDescription())
                .shell(entity.getShell() != null ? entity.getShell().name() : null)
                .scriptBody(entity.getScriptBody())
                .tag(entity.getTag())
                .supportedPlatforms(mapPlatformsToResponse(entity.getSupportedPlatforms()))
                .defaultTimeoutSeconds(entity.getDefaultTimeoutSeconds())
                .defaultArgs(entity.getDefaultArgs())
                .envVars(mapEnvVarsToResponse(entity.getEnvVars()))
                .createdAt(entity.getCreatedAt())
                .updatedAt(entity.getUpdatedAt())
                .build();
    }

    public CursorPaginationCriteria toCursorPaginationCriteria(ConnectionArgs args) {
        return CursorPaginationCriteria.fromConnectionArgs(args);
    }

    public GenericConnection<GenericEdge<ScriptResponse>> toConnection(
            GenericQueryResult<ScriptResponse> result) {
        List<GenericEdge<ScriptResponse>> edges = result.getItems().stream()
                .map(view -> GenericEdge.<ScriptResponse>builder()
                        .node(view)
                        .cursor(CursorCodec.encode(view.getId()))
                        .build())
                .toList();

        return GenericConnection.<GenericEdge<ScriptResponse>>builder()
                .edges(edges)
                .pageInfo(result.getPageInfo())
                .build();
    }

    private List<ScriptEnvVar> mapEnvVarsToEntity(List<ScriptEnvVarDto> envVars) {
        if (envVars == null) {
            return null;
        }
        return envVars.stream()
                .map(v -> ScriptEnvVar.builder()
                        .name(v.getName())
                        .value(v.getValue())
                        .secret(v.isSecret())
                        .build())
                .toList();
    }

    private List<ScriptEnvVarDto> mapEnvVarsToResponse(List<ScriptEnvVar> envVars) {
        if (envVars == null) {
            return null;
        }
        return envVars.stream()
                .map(v -> ScriptEnvVarDto.builder()
                        .name(v.getName())
                        // TODO: mask {@link ScriptEnvVar#getValue()} when {@code secret == true}
                        // once secret-management (encryption at rest + secure agent delivery) lands.
                        // Until then, secret variables are rejected on write, so no plaintext leak
                        // can occur via this path.
                        .value(v.getValue())
                        .secret(v.isSecret())
                        .build())
                .toList();
    }

    private List<String> mapPlatformsToResponse(List<ScriptPlatform> platforms) {
        if (platforms == null) {
            return null;
        }
        return platforms.stream().map(ScriptPlatform::name).toList();
    }
}
