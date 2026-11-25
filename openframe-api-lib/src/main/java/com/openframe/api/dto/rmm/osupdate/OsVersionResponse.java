package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class OsVersionResponse {

    String osVersion;
    int deviceCount;
    // Null = no latest security build is stored for the version.
    Integer devicesBehindCount;
    String currentBuild;
    // Home and Pro editions.
    LocalDate endOfSupportAt;
    Boolean supportEnded;
    // Enterprise and Education editions.
    LocalDate enterpriseEndOfSupportAt;
    Boolean enterpriseSupportEnded;
    String cursor;
}
