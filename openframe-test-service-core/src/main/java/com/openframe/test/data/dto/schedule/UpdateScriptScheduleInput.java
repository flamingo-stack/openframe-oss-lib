package com.openframe.test.data.dto.schedule;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Full-replacement (PUT) payload for the {@code updateScriptSchedule} mutation: every writable field
 * overwrites the stored value, and a null clears an optional one. Nulls are therefore serialised
 * on purpose (no {@code NON_NULL} filter) so a test can prove that, for example, {@code repeat: null}
 * turns a recurring schedule into a one-shot. {@code name} and {@code trigger} cannot be null.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateScriptScheduleInput {
    private String id;
    private String name;
    private String description;
    private List<String> supportedPlatforms;
    private List<String> scriptIds;
    private String trigger;
    private String timeReference;
    private String offlineBehavior;
    private Long reconnectWindowSeconds;
    private String selectionMode;
    private String startAt;
    private Long repeat;
}
