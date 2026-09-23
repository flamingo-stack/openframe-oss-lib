package com.openframe.data.document.rmm.script;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RunningExecutionRows {

    String tenantId;
    String executionId;
    String scriptId;
    String scheduleId;
    List<String> machineIds;
    PrivilegeLevel privilegeLevel;
    Integer timeoutSeconds;
    String initiatedBy;
    ExecutionSource source;

    PackageManagerType packageManager;
    String packageName;
    SoftwareAction softwareAction;

    String softwareBundleId;
    String softwareScheduleId;
}
