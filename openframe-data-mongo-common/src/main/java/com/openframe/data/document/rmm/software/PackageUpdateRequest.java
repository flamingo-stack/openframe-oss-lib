package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.packagesearch.BrewPackageType;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "package_update_request")
@CompoundIndex(name = "tenant_requestId", def = "{'tenantId': 1, 'requestId': 1}", unique = true)
@CompoundIndex(name = "tenant_status", def = "{'tenantId': 1, 'status': 1}")
public class PackageUpdateRequest implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String requestId;

    private String executionId;

    private SoftwareAction action;
    private PackageUpdateSource source;

    private PackageManagerType packageManager;
    private String packageName;
    private BrewPackageType brewPackageType;

    private PackageUpdateMode mode;

    private Integer forceCountdownSeconds;

    private Long deadlineSeconds;

    private SoftwareActionStatus status;

    private List<String> machineIds;
    private int totalMachineCount;

    private int attempts;

    private String initiatedBy;

    private Instant createdAt;
    private Instant updatedAt;
}
