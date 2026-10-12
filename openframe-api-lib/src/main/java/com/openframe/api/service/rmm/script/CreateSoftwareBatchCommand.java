package com.openframe.api.service.rmm.script;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.script.ExecutionSource;
import com.openframe.data.document.rmm.script.PrivilegeLevel;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.Builder;
import lombok.Getter;

import java.util.List;

@Getter
@Builder
public class CreateSoftwareBatchCommand {
    private final String executionId;
    private final String scriptId;
    private final List<String> machineIds;
    private final PrivilegeLevel privilegeLevel;
    private final Integer timeoutSeconds;
    private final String initiatedBy;
    private final ExecutionSource source;
    private final PackageManagerType packageManager;
    private final String packageName;
    private final SoftwareAction softwareAction;
}
