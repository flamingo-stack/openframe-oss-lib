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

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "package_auto_update_policies")
@CompoundIndex(name = "tenant_machine_package", def = "{'tenantId': 1, 'machineId': 1, 'packageManager': 1, 'packageName': 1}", unique = true)
@CompoundIndex(name = "tenant_package", def = "{'tenantId': 1, 'packageManager': 1, 'packageName': 1}")
@CompoundIndex(name = "tenant_software", def = "{'tenantId': 1, 'softwareId': 1}")
public class PackageAutoUpdatePolicy implements TenantScoped {

    @Id
    private String id;

    private String tenantId;
    private String machineId;

    private PackageManagerType packageManager;
    private String packageName;
    private BrewPackageType brewPackageType;
    private String softwareId;

    private boolean enabled;
    private PackageUpdateSettings settings;

    private String createdBy;
    private Instant createdAt;
    private String updatedBy;
    private Instant updatedAt;
}
