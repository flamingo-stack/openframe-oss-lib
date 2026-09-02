package com.openframe.packagesearch.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PackageVersion {

    private String version;
    private Instant releasedAt;
    private Boolean prerelease;
}
