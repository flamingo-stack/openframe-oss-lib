package com.openframe.client.dto.agent;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.DeviceType;
import lombok.Data;

import jakarta.validation.Valid;

import java.util.List;

@Data
public class AgentRegistrationRequest {
    // Core identification
    private String hostname;
    private String organizationId;

    // Network information
    private String ip;
    private String macAddress;
    private String osUuid;
    private String agentVersion;
    private DeviceStatus status;

    // Hardware information
    private String displayName;
    private String serialNumber;
    private String manufacturer;
    private String model;

    // OS information
    private DeviceType type;
    private String osType;
    private String osVersion;
    private String osBuild;
    private String timezone;

    // Tags to create and assign to the device at registration time
    @Valid
    private List<AgentRegistrationTagInput> tags;
} 