package com.openframe.test.data.generator;

import com.openframe.test.data.dto.schedule.CreateScriptScheduleInput;
import com.openframe.test.data.dto.schedule.ScriptSchedule;
import com.openframe.test.data.dto.schedule.UpdateScriptScheduleInput;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

/**
 * Builds script-schedule payloads that respect the schema's timing grid: {@code startAt} on a
 * 30-minute boundary (xx:00 or xx:30) and {@code repeat} in whole 30-minute slots.
 */
public final class ScriptScheduleGenerator {

    /** The runner's tick: every valid startAt and repeat is a multiple of this many seconds. */
    public static final long SLOT_SECONDS = 1800;

    /** One hour, expressed in slots — the smallest recurrence that is not the grid itself. */
    public static final long HOURLY = 2 * SLOT_SECONDS;

    /**
     * Enough lead for a case to create, read back, edit and archive the schedule before the slot
     * arrives, so a run that straddles the boundary does not fire mid-assertion.
     */
    public static final Duration DEFAULT_LEAD = Duration.ofMinutes(3);

    private ScriptScheduleGenerator() {
    }

    /**
     * The nearest 30-minute boundary at least {@code minLead} after now — the closest slot the
     * schedule can legally take. Exact to the second, so {@code Instant.toString()} yields
     * {@code 2026-09-13T10:30:00Z} with no fraction.
     */
    public static Instant nextSlot(Duration minLead) {
        long earliest = Instant.now().plus(minLead).getEpochSecond();
        long slots = Math.floorDiv(earliest + SLOT_SECONDS - 1, SLOT_SECONDS);
        return Instant.ofEpochSecond(slots * SLOT_SECONDS);
    }

    public static Instant nextSlot() {
        return nextSlot(DEFAULT_LEAD);
    }

    /**
     * A DATE_TIME schedule on the server clock that runs one script at {@code startAt} and, when
     * {@code repeat} is non-null, every {@code repeat} seconds after it. No devices are assigned, so
     * nothing dispatches when the slot arrives.
     */
    public static CreateScriptScheduleInput dateTimeSchedule(String name, String scriptId, Instant startAt, Long repeat) {
        return CreateScriptScheduleInput.builder()
                .name(name)
                .description("E2E schedule for " + name)
                .supportedPlatforms(List.of("WINDOWS"))
                .scriptIds(List.of(scriptId))
                .trigger("DATE_TIME")
                .startAt(startAt.toString())
                .repeat(repeat)
                .build();
    }

    /**
     * Full-replacement update derived from an existing schedule, changing only the name and the
     * recurrence. Every other writable field is echoed back so the PUT semantics of
     * {@code updateScriptSchedule} clear exactly what the caller intends to clear.
     */
    public static UpdateScriptScheduleInput updateRequest(ScriptSchedule schedule, String name, Long repeat) {
        return UpdateScriptScheduleInput.builder()
                .id(schedule.getId())
                .name(name)
                .description(schedule.getDescription())
                .supportedPlatforms(schedule.getSupportedPlatforms())
                .scriptIds(schedule.getScripts() == null ? List.of()
                        : schedule.getScripts().stream().map(s -> s.getId()).toList())
                .trigger(schedule.getTrigger())
                .timeReference(schedule.getTimeReference())
                .offlineBehavior(schedule.getOfflineBehavior())
                .reconnectWindowSeconds(schedule.getReconnectWindowSeconds())
                .selectionMode(schedule.getSelectionMode())
                .startAt(schedule.getStartAt())
                .repeat(repeat)
                .build();
    }
}
