package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class SoftwareAdoptionResponse {
    private SoftwareAdoptionStatus status;
    private PackageManagerType packageManager;
    private String error;
}
