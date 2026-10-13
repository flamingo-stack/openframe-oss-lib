package com.openframe.api.dto.device;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

// GraphQL DeviceEnrollment: a timestamp stays null until its stage is reached and is never cleared.
@Value
@Builder
public class DeviceEnrollmentResponse {
    Instant registeredAt;
    Instant connectedAt;
    Instant inventoryConnectedAt;
    boolean ready;
}
