package com.openframe.data.document.rmm;

/**
 * What causes a {@link ScriptSchedule} to fire.
 *
 * <ul>
 *   <li>{@link #DATE_TIME} — time-driven: the management runner fires it on the
 *       half-hour grid from {@code startAt} + {@code repeat} (via {@code nextRunAt}).</li>
 *   <li>{@link #DEVICE_ONLINE} — event-driven: fires when an assigned device comes
 *       online. It has no timing ({@code startAt}/{@code repeat}/{@code nextRunAt} stay
 *       null) so the time-driven runner never picks it up.</li>
 * </ul>
 *
 * <p>A {@code null} trigger on a stored document is treated as {@link #DATE_TIME}
 * (backward compatibility with schedules created before this field existed).
 */
public enum ScriptScheduleTrigger {
    DATE_TIME,
    DEVICE_ONLINE
}
