package com.openframe.documents.device;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "devices")
public class Device {
    @Id
    private String id;
    private String machineId;      // Link to Machine entity
    private String serialNumber;
    private String model;
    private String osVersion;
    private String status;         // ACTIVE, OFFLINE, MAINTENANCE
    private DeviceType type;       // DESKTOP, LAPTOP, SERVER, etc.
    private Instant lastCheckin;
    private DeviceConfiguration configuration;
    private DeviceHealth health;
}
