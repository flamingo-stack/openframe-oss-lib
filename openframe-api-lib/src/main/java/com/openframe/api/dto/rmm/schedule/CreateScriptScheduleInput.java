package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * Input payload for creating a new script schedule. Tenant attribution is taken
 * from the authenticated principal at the resolver layer — clients do not (and
 * must not) supply a tenant id here.
 */
@Data
public class CreateScriptScheduleInput {

    @NotBlank
    private String name;

    private String description;

    private List<ScriptPlatform> supportedPlatforms;

    private List<String> scriptIds;
}
