package com.openframe.data.nats.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Cross-service event emitted when a device transitions offline→online.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceOnlineEvent {

    public static final String SUBJECT = "device.status.online";

    private String tenantId;
    private String machineId;
    private Instant occurredAt;
}
