package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SoftwareOnDeviceResponse {

    private Machine device;
    private String softwareVersion;
    private SoftwareOnDeviceStatus status;
    private SoftwareAutoUpdateStatus autoUpdate;
}
