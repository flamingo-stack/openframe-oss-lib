package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Data;

import java.util.List;

@Data
public class SoftwareActionDeviceFilterInput {

    private List<SoftwareActionStatus> statuses;
    private List<String> organizationIds;
}
