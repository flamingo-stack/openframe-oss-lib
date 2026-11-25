package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class OsVersionDeviceResponse {

    String machineId;
    String osBuild;
    String osProductName;
    // Null = no latest security build is stored for the version, or the device reported no build.
    Boolean upToDate;
    // Of the edition group of the device.
    LocalDate endOfSupportAt;
    Boolean supportEnded;
    String cursor;
}
