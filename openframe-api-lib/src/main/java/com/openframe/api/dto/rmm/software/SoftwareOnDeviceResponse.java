package com.openframe.api.dto.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Per-device row for a software title. The {@code device} GraphQL field is
 * resolved in the DataFetcher by looking up {@code machineId} against the
 * device service.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareOnDeviceResponse {
    private String machineId;
    private String softwareVersion;
    private SoftwareOnDeviceStatus status;
}
