package com.openframe.test.data.dto.external.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.List;

/**
 * Device information
 *
 * <p>Generated from the OpenFrame External API OpenAPI contract ({@code GET /api-docs}), version 1.1.0.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceResponse {

    private String id;

    private String machineId;

    private String hostname;

    private String displayName;

    private String nickname;

    private String ip;

    private String macAddress;

    private String osUuid;

    private String agentVersion;

    /** Contract values: ACTIVE, PENDING, INACTIVE, MAINTENANCE, DECOMMISSIONED, ONLINE, OFFLINE, PENDING_DELETION, DELETED, ARCHIVED. Kept as String so a new backend value deserializes rather than throwing. */
    private String status;

    private Instant lastSeen;

    private String customerId;

    private String serialNumber;

    private String manufacturer;

    private String model;

    /** Contract values: DESKTOP, LAPTOP, SERVER, MOBILE_DEVICE, TABLET, NETWORK_DEVICE, IOT_DEVICE, VIRTUAL_MACHINE, CONTAINER_HOST, OTHER. Kept as String so a new backend value deserializes rather than throwing. */
    private String type;

    private String osType;

    private String osVersion;

    private String osBuild;

    private String timezone;

    private Instant registeredAt;

    private Instant updatedAt;

    private List<DeviceTagResponse> tags;
}
