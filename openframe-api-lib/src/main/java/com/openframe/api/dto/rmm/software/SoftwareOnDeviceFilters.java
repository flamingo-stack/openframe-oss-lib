package com.openframe.api.dto.rmm.software;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareOnDeviceFilters {

    private List<SoftwareFilterOption> statuses;
}
