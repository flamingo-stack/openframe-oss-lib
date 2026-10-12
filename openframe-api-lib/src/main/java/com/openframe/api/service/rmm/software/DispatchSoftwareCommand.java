package com.openframe.api.service.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class DispatchSoftwareCommand {

    PackageManagerType packageManager;
    String packageName;
    SoftwareAction action;
}
