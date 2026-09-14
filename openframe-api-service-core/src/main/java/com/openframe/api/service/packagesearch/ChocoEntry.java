package com.openframe.api.service.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
class ChocoEntry {

    private String id;
    private String title;
    private String summary;
    private String description;
    private String version;
    private Integer downloadCount;
    private String iconUrl;
    private String projectUrl;
    private String tags;
    private Instant published;
    private Boolean prerelease;
}

