package com.openframe.data.document.rmm.software;

import com.openframe.data.document.TenantScoped;
import com.openframe.data.document.rmm.script.OsType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "tenant_software")
@CompoundIndex(
        name = "tenant_softwareTitleId",
        def = "{'tenantId': 1, 'softwareTitleId': 1}",
        unique = true)
@CompoundIndex(name = "tenant_name", def = "{'tenantId': 1, 'nameLower': 1}")
@CompoundIndex(name = "tenant_devicesCount", def = "{'tenantId': 1, 'devicesCount': -1}")
@CompoundIndex(name = "tenant_cveCount", def = "{'tenantId': 1, 'cveCount': -1}")
public class TenantSoftware implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private Long softwareTitleId;

    private String name;

    private String nameLower;

    private String source;

    private String browser;

    private String latestVersion;

    private int olderVersionsCount;

    private int devicesCount;

    private int cveCount;

    private String highestSeverity;

    @Indexed
    private List<OsType> osTypes;

    private Boolean cpeMatched;

    private Instant updatedAt;
}
