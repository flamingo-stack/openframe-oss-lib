package com.openframe.api.dto.rmm.software;

import com.openframe.data.document.rmm.software.SoftwareAction;
import com.openframe.data.document.rmm.software.SoftwareBundlePackage;
import com.openframe.data.document.rmm.software.SoftwareBundleStatus;
import lombok.Builder;
import lombok.Data;

import java.time.Instant;
import java.util.List;

@Data
@Builder
public class SoftwareBundleResponse {

    private String id;
    private SoftwareAction action;
    private SoftwareBundleStatus status;
    private List<String> machineIds;
    private List<SoftwareBundlePackage> packages;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
    private List<String> executionIds;
}
