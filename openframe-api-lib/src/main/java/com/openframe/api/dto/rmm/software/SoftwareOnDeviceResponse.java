package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.device.Machine;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SoftwareOnDeviceResponse {

    private Machine device;
    private String softwareVersion;
    private SoftwareOnDeviceStatus status;
}
