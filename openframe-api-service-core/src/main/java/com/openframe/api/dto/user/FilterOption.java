package com.openframe.api.dto.user;

/**
 * One value a list's funnel offers.
 *
 * @param count how many rows the list would show with this value ticked alone in its funnel
 */
public record FilterOption<T>(T value, int count) {
}
