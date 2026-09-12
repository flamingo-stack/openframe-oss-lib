package com.openframe.test.data.dto.device;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * One entry of the {@code POST api/force/client/uninstall} response: the machine the uninstall command
 * was issued for and the platform's disposition ({@code PROCESSED}, or a skip reason for an unknown or
 * already deleted machine).
 */
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ForceClientUninstallItem {
    private String machineId;
    private String status;
}
