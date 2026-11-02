package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.rmm.software.SoftwareAutoUpdateStatus;
import lombok.Data;

import java.util.List;

@Data
public class SoftwareOnDeviceFilterInput {

    private List<SoftwareOnDeviceStatus> statuses;
    private List<String> deviceTagIds;
    private List<String> organizationIds;
    private List<DeviceStatus> deviceStatuses;
    private List<SoftwareSource> installedBy;
    private List<SoftwareAutoUpdateStatus> autoUpdateStatuses;
}
