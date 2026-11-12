package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class SoftwareAutoUpdatePolicyResponse {

    private boolean enabled;
    private PackageUpdateSettings settings;
    private List<String> machineIds;
}
