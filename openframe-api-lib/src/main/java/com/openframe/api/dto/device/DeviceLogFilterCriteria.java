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
     * Case-insensitive substring match on the log message.
     */
    private String search;

    /**
     * Inclusive lower bound; defaults to {@code to} minus the default lookback.
     */
    private Instant from;

    /**
     * Inclusive upper bound; defaults to now.
     */
    private Instant to;
}
