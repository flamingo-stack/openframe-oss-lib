package com.openframe.api.dto.device;

import jakarta.validation.constraints.Size;
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
public class DeviceLogFilterInput {

    private List<DeviceLogLevel> levels;

    @Size(max = 256, message = "search cannot exceed 256 characters")
    private String search;

    private Instant from;

    private Instant to;
}
