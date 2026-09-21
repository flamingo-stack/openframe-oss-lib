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

    @Size(max = 5, message = "cannot hold more than 5 terms")
    private List<@Size(max = 256, message = "cannot exceed 256 characters") String> contains;

    @Size(max = 5, message = "cannot hold more than 5 terms")
    private List<@Size(max = 256, message = "cannot exceed 256 characters") String> excludes;

    private Instant from;

    private Instant to;
}
