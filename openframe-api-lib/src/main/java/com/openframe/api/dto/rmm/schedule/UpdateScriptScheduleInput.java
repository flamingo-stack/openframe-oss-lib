package com.openframe.api.dto.rmm.schedule;

import com.openframe.data.document.rmm.ScriptPlatform;
import com.openframe.data.document.rmm.ScriptScheduleTrigger;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
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

    @NotNull
    private ScriptScheduleTrigger trigger;

    /**
     * First scheduled run as an absolute UTC instant. PUT semantics: null clears
     * the timing (the schedule stops being picked up). Changing this value
     * reschedules the next run (see {@code ScriptScheduleService.update}).
     */
    private Instant startAt;

    /** Recurrence interval in seconds; null clears recurrence (one-shot). Must be a whole number
     * of 30-minute slots (1800, 3600, 5400, …) — the runner ticks on that grid. */
    @Min(value = 1800, message = "repeat must be at least 1800 seconds (30 minutes)")
    private Long repeat;
}
