package com.openframe.api.service.packagesearch;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;

import java.time.Instant;

@Getter
@Builder
@AllArgsConstructor
class ChocoEntry {

    private final String id;
    private final String title;
    private final String summary;
    private final String description;
    private final String version;
    private final Integer downloadCount;
    private final String iconUrl;
    private final String projectUrl;
    private final String tags;
    private final Instant published;
    private final Boolean prerelease;
}
