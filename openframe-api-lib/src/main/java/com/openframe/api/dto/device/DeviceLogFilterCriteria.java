package com.openframe.api.dto.device;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceLogFilterCriteria {

    /**
     * Any of these levels; all levels when empty.
     */
    private List<DeviceLogLevel> levels;

    /**
     * Every term must appear in the message, matched case-insensitively and literally.
     */
    private List<String> contains;

    /**
     * No term may appear in the message, matched the same way.
     */
    private List<String> excludes;

    /**
     * Opt-in RE2 pattern, applied case-insensitively.
     */
    private String regex;

    /**
     * Inclusive lower bound; defaults to {@code to} minus the default lookback.
     */
    private Instant from;

    /**
     * Inclusive upper bound; defaults to now.
     */
    private Instant to;
}
