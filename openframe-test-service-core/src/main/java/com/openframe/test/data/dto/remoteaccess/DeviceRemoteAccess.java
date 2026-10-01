package com.openframe.test.data.dto.remoteaccess;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// Machine.remoteAccess: mode is the device override (null while it inherits); effectiveScope is DEVICE, ORGANIZATION, TENANT or DEFAULTS.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class DeviceRemoteAccess {
    private String mode;
    private String effectiveMode;
    private String effectiveScope;
    private String updatedBy;
    private String updatedAt;
}
