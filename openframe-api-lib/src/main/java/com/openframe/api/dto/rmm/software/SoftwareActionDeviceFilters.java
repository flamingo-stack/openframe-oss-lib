package com.openframe.api.dto.rmm.software;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareActionDeviceFilters {

    @Builder.Default
    private List<SoftwareFilterOption> statuses = List.of();
    @Builder.Default
    private List<SoftwareFilterOption> organizations = List.of();
    private int filteredCount;
}
