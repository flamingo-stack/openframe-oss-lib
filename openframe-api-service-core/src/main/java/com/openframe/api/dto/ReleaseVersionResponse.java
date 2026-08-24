package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReleaseVersionResponse {
    private String id;
    private String releaseVersion;
    private Instant createdAt;
    private Instant updatedAt;
}

