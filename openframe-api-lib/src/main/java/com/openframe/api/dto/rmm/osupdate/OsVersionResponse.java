package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class OsVersionResponse {

    String osVersion;
    int deviceCount;
    // Null = no reference data for the version.
    Integer devicesBehindCount;
    String currentBuild;
    LocalDate endOfSupportAt;
    Boolean supportEnded;
    String cursor;
}
