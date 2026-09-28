package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SoftwareDispatchResult {

    private PackageManagerType packageManager;
    private String packageName;
    private String executionId;
}
