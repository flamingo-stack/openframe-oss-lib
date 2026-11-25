package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class OsVersionDeviceResponse {

    String machineId;
    String osBuild;
    String osProductName;
    // Null = no reference data for the version.
    Boolean upToDate;
    String cursor;
}
