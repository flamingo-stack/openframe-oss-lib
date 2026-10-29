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

    public static SoftwareFilters empty() {
        return SoftwareFilters.builder()
                .sources(List.of())
                .versionStatuses(List.of())
                .severities(List.of())
                .build();
    }
}
