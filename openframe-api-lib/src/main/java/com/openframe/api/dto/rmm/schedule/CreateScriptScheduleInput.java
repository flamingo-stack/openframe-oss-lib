package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.Instant;
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

    /**
     * First scheduled run as an absolute UTC instant (the dashboard converts the
     * chosen Date + Time to UTC). Optional — a schedule with no startAt is never
     * picked up by the runner until one is set.
     */
    private Instant startAt;

    @Min(value = 1800, message = "repeat must be at least 1800 seconds (30 minutes)")
    private Long repeat;
}
