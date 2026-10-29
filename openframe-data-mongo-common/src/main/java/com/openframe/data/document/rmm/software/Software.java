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
public class Software implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private Long softwareTitleId;

    private String name;

    private String nameLower;

    private String source;

    private String browser;

    private String latestVersion;

    private int devicesCount;

    private int cveCount;

    private List<Installation> installations;

    private List<String> cveIds;

    private Instant updatedAt;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Installation {
        private String machineId;
        private Long hostId;
        private List<String> versions;
        private Instant lastSeenAt;
    }
}
