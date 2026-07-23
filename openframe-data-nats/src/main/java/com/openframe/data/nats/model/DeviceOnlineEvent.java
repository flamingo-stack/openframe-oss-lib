package com.openframe.data.nats.model;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

/**
 * Cross-service event emitted when a device transitions offline→online. The client service relays
 * it over core NATS on {@link #SUBJECT}; the management service subscribes and fires the machine's
 * ACTIVE, DEVICE_ONLINE-triggered schedules on that machine.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceOnlineEvent {

    /** Fixed core-NATS subject both sides agree on. */
    public static final String SUBJECT = "device.status.online";

    private String tenantId;
    private String machineId;
    private Instant occurredAt;
}
