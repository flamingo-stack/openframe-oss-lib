package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class OsUpdateDeviceResponse {

    private String machineId;
    private OsUpdateDeviceStatus status;
    private Instant discoveredAt;
    private Instant installedAt;
    private String cursor;
}
