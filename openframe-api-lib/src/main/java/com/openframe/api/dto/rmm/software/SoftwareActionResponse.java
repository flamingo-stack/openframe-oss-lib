package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.packagesearch.PackageManagerType;
import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareActionStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;

@Data
@Builder
public class SoftwareActionResponse {

    private String id;
    private String executionId;

    private String software;
    private SoftwareAction action;
    private PackageManagerType engine;
    private SoftwareActionStatus status;

    private int totalMachineCount;
    private int respondedMachineCount;

    private Instant scheduledAt;
    private Instant dispatchedAt;
    private Instant finishedAt;
    private String initiatedBy;
}
