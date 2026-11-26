package com.openframe.api.dto.rmm.osupdate;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDate;

@Value
@Builder
public class OsVersionResponse {

    private String osVersion;
    int deviceCount;
    // Null = no latest security build is stored for the version.
    private Integer devicesBehindCount;
    private String currentBuild;
    // Home and Pro editions.
    private LocalDate endOfSupportAt;
    private Boolean supportEnded;
    // Enterprise and Education editions.
    private LocalDate enterpriseEndOfSupportAt;
    private Boolean enterpriseSupportEnded;
    private String cursor;
}
