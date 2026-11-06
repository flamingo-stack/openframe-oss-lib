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
@Document(collection = "software")
@CompoundIndex(name = "tenant_title", def = "{'tenantId': 1, 'softwareTitleId': 1}", unique = true)
@CompoundIndex(name = "tenant_name", def = "{'tenantId': 1, 'nameLower': 1}")
@CompoundIndex(name = "tenant_devices", def = "{'tenantId': 1, 'devicesCount': -1}")
@CompoundIndex(name = "tenant_cveCount", def = "{'tenantId': 1, 'cveCount': -1}")
@CompoundIndex(name = "installations_machine", def = "{'tenantId': 1, 'installations.machineId': 1}")
@CompoundIndex(name = "tenant_source", def = "{'tenantId': 1, 'source': 1}")
@CompoundIndex(name = "tenant_match_state", def = "{'tenantId': 1, 'packageMatch.state': 1}")
public class Software implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private Long softwareTitleId;

    private String name;

    private String nameLower;

    private String source;

    // what the Windows programs table reports, as the OpenFrame Fleet returns it; empty for other sources
    private String vendor;
    private String upgradeCode;
    private List<String> arpKeys;
    private List<String> packageFamilyNames;
    private Boolean systemComponent;
    private List<String> installerTypes;
    // null until the projector matched the title, or when no matcher handles its source
    private SoftwarePackageMatch packageMatch;

    private String latestVersion;

    private int devicesCount;

    private int cveCount;

    private List<Installation> installations;

    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Installation {
        private String machineId;
        private List<String> versions;
    }
}
