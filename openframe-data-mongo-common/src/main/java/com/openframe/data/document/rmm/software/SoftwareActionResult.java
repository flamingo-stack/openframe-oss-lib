package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.packagesearch.PackageManagerType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "software_actions_result")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SoftwareActionResult implements TenantScoped {

    @Id
    private String id;

    private String tenantId;
    private String executionId;

    private SoftwareAction action;
    private PackageManagerType packageManager;
    private String packageName;
    private String version;

    private SoftwareActionStatus status;
    private SoftwareBundleMode mode;

    private List<String> machineIds;
    private int totalMachineCount;

    private String bundleId;
    private String scheduleId;

    private Instant scheduledAt;
    private Instant dispatchedAt;

    private String initiatedBy;
    private Instant createdAt;
}
