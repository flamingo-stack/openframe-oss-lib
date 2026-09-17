package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "software_bundles")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareBundle implements TenantScoped {

    @Id
    private String id;

    private String tenantId;
    private SoftwareAction action;
    private SoftwareBundleStatus status;
    private List<String> machineIds;
    private List<SoftwareBundlePackage> packages;
    private List<String> executionIds;

    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;
    private Instant completedAt;
    private Instant expireAt;
}
