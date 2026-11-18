package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
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
@Document(collection = "software_adoptions")
@CompoundIndex(name = "tenant_software_machine", def = "{'tenantId': 1, 'softwareId': 1, 'machineId': 1}", unique = true)
@CompoundIndex(name = "tenant_request_machine", def = "{'tenantId': 1, 'requestId': 1, 'machineId': 1}")
public class SoftwareAdoption implements TenantScoped {

    @Id
    private String id;

    private String tenantId;
    private String machineId;
    private String softwareId;

    private PackageManagerType packageManager;
    private String packageName;
    private String requestId;

    private SoftwareAdoptionStatus status;
    private String error;

    private Instant createdAt;
}
