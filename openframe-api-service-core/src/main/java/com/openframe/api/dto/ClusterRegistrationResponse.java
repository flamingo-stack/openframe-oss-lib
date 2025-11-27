package com.openframe.api.dto;

import java.time.Instant;

public record ClusterRegistrationResponse(
        String id,
        String imageTagVersion,
        Instant createdAt,
        Instant updatedAt
) {
}

