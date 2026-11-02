package com.openframe.api.dto.rmm.software;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareFilters {

    private List<SoftwareFilterOption> sources;
    private List<SoftwareFilterOption> versionStatuses;
    private List<SoftwareFilterOption> severities;

    // non-null in the schema; the tenant-wide facet stays empty until the read model backs it
    @Builder.Default
    private List<SoftwareFilterOption> autoUpdateStatuses = List.of();

    public static SoftwareFilters empty() {
        return SoftwareFilters.builder()
                .sources(List.of())
                .versionStatuses(List.of())
                .severities(List.of())
                .build();
    }
}
