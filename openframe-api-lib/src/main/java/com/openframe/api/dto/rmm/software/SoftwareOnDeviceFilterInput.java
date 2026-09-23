package com.openframe.api.dto.rmm.software;

import lombok.Data;

import java.util.List;

@Data
public class SoftwareOnDeviceFilterInput {

    private List<SoftwareOnDeviceStatus> statuses;
    private List<String> deviceTagIds;
}
