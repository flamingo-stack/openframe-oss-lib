package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One organization's remote-access policy: mode is the override (null while it inherits), effectiveMode what applies.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class OrganizationRemoteAccessPolicy {
    private String organizationId;
    private String mode;
    private String effectiveMode;
    private String updatedBy;
    private String updatedAt;
}
