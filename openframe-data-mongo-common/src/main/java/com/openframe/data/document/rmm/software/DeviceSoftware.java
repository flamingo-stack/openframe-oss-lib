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
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "device_software")
@CompoundIndex(
        name = "tenant_machine_title",
        def = "{'tenantId': 1, 'machineId': 1, 'softwareTitleId': 1}",
        unique = true)
@CompoundIndex(
        name = "tenant_machine",
        def = "{'tenantId': 1, 'machineId': 1}")
@CompoundIndex(
        name = "tenant_title",
        def = "{'tenantId': 1, 'softwareTitleId': 1}")
@CompoundIndex(
        name = "tenant_vuln",
        def = "{'tenantId': 1, 'vulnerabilities': 1}")
public class DeviceSoftware implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private Long hostId;

    private Long softwareTitleId;

    private String name;

    private List<String> versions;

    private List<String> vulnerabilities;

    private String source;

    private boolean isConnected;

    private Instant updatedAt;
}
