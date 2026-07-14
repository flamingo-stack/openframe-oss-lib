package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.util.List;

/**
 * Input payload for fully replacing an existing script schedule (PUT semantics):
 * every writable field overwrites the stored value, including {@code null}s
 * which clear the field. Callers must send the full resource on every update.
 */
@Data
public class UpdateScriptScheduleInput {

    @NotBlank
    private String id;

    @NotBlank
    private String name;

    private String description;

    private List<ScriptPlatform> supportedPlatforms;

    private List<String> scriptIds;
}
