package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.PackageUpdateSettings;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareAutoUpdatePolicyResponse {

    private boolean enabled;
    private PackageUpdateSettings settings;
    private List<String> machineIds;
}
