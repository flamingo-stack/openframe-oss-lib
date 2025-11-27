package com.openframe.api.dto;

import java.time.Instant;

public record ReleaseVersionResponse(
        String id,
        String releaseVersion,
        Instant createdAt,
        Instant updatedAt
) {
}

