package com.openframe.api.dto.rmm.software;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareOnDeviceFilters {

    private List<SoftwareFilterOption> statuses;

    // empty until the read model and the auto-update policy back them: the schema fields are non-null
    @Builder.Default
    private List<SoftwareFilterOption> installedBy = List.of();
    @Builder.Default
    private List<SoftwareFilterOption> autoUpdateStatuses = List.of();
    @Builder.Default
    private List<SoftwareFilterOption> organizations = List.of();
    @Builder.Default
    private List<SoftwareFilterOption> deviceStatuses = List.of();
}
