package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
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
@Document(collection = "device_cve")
@CompoundIndex(
        name = "tenant_machine_cve_title",
        def = "{'tenantId': 1, 'machineId': 1, 'cveId': 1, 'softwareTitleId': 1}",
        unique = true)
@CompoundIndex(name = "tenant_cve", def = "{'tenantId': 1, 'cveId': 1}")
@CompoundIndex(name = "tenant_title", def = "{'tenantId': 1, 'softwareTitleId': 1}")
@CompoundIndex(name = "tenant_machine_discovered", def = "{'tenantId': 1, 'machineId': 1, 'discoveredAt': -1}")
public class DeviceCve implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private Long hostId;

    private String cveId;

    private Long softwareTitleId;

    private String name;

    private String installedVersion;

    private String resolvedInVersion;

    private Instant discoveredAt;

    private Instant updatedAt;
}
