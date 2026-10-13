package com.openframe.api.dto.device;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class DeviceEnrollmentResponse {
    Instant registeredAt;
    Instant connectedAt;
    Instant inventoryConnectedAt;
    boolean ready;
}
