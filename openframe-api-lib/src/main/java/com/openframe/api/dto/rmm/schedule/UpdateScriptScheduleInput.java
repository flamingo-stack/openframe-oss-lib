package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

import java.time.Instant;
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

    /**
     * First scheduled run as an absolute UTC instant. PUT semantics: null clears
     * the timing (the schedule stops being picked up). Changing this value
     * reschedules the next run (see {@code ScriptScheduleService.update}).
     */
    private Instant startAt;

    /** Recurrence interval in minutes (smallest allowed is 30); null clears recurrence (one-shot). */
    @Min(value = 30, message = "repeatIntervalMinutes must be at least 30")
    private Integer repeatIntervalMinutes;
}
