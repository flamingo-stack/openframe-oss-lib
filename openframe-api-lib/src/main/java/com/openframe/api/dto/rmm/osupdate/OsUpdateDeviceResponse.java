package com.openframe.api.dto.rmm.osupdate;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.Instant;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OsUpdateDeviceResponse {

    private String machineId;
    private OsUpdateDeviceStatus status;
    private Instant discoveredAt;
    private Instant installedAt;
    private String cursor;
}
