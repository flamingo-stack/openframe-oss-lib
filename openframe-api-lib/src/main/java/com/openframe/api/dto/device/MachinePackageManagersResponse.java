package com.openframe.api.dto.device;

import com.openframe.data.document.packagesearch.PackageManagerState;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class MachinePackageManagersResponse {

    private PackageManagerState brew;
    private PackageManagerState winget;
    private PackageManagerState choco;
}
