package com.openframe.api.dto.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareOnDeviceResponse {
    private String machineId;
    private String softwareVersion;
    private SoftwareOnDeviceStatus status;
}
