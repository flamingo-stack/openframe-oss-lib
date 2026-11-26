package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class OsVersionDeviceResponse {

    private String machineId;
    private String osBuild;
    private String osProductName;
    // Null = no latest security build is stored for the version, or the device reported no build.
    private Boolean upToDate;
    // Of the edition group of the device.
    private LocalDate endOfSupportAt;
    private Boolean supportEnded;
    private String cursor;
}
