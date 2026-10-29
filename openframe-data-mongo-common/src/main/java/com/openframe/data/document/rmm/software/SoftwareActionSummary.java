package com.openframe.data.document.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SoftwareActionSummary {

    private String executionId;
    private PackageManagerType packageManager;
    private String packageName;
    private String version;
    private SoftwareAction action;
    private SoftwareActionStatus status;
    private int totalMachineCount;
    private int respondedMachineCount;
    private int waitingMachineCount;
    private Instant dispatchedAt;
    private String initiatedBy;

    private String bundleId;
    private String scheduleId;
}
