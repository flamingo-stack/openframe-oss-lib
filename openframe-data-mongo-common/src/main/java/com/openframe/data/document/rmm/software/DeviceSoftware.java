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
        name = "tenant_title_connected",
        def = "{'tenantId': 1, 'softwareTitleId': 1, 'machineConnected': 1, 'machineId': 1}")
@CompoundIndex(
        name = "tenant_vuln_connected",
        def = "{'tenantId': 1, 'vulnerabilities': 1, 'machineConnected': 1, 'machineId': 1}")
public class DeviceSoftware implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String machineId;

    private Long softwareTitleId;

    private String name;

    private List<String> versions;

    private List<String> vulnerabilities;

    private String source;

    // what the Windows programs table reports, as the OpenFrame Fleet returns it; empty for other sources
    private String vendor;
    private String upgradeCode;
    private List<String> arpKeys;
    private List<String> packageFamilyNames;
    private Boolean systemComponent;
    private List<String> installerTypes;
    // set for a winget_packages row: the id winget installed the package under, the one `winget upgrade --id` takes
    private String wingetId;
    private boolean machineConnected;

    private Instant updatedAt;
}
