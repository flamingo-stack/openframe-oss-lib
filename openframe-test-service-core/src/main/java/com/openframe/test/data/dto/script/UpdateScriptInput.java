package com.openframe.test.data.dto.script;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Full-replacement (PUT) payload for the {@code updateScript} mutation. The target
 * script {@code id} travels inside the input; required fields (name, shell,
 * scriptBody, privilegeLevel) must be present.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class UpdateScriptInput {
    private String id;
    private String name;
    private String description;
    private String shell;
    private String privilegeLevel;
    private String scriptBody;
    private List<String> supportedPlatforms;
    private Integer defaultTimeoutSeconds;
    private List<String> defaultArgs;
    private List<ScriptEnvVar> envVars;
    private List<String> tagIds;
}
