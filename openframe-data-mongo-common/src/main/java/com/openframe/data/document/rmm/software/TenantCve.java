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
@Document(collection = "tenant_cve")
@CompoundIndex(
        name = "tenant_cveId",
        def = "{'tenantId': 1, 'cveId': 1}",
        unique = true)
@CompoundIndex(name = "tenant_discoveredAt", def = "{'tenantId': 1, 'discoveredAt': -1}")
@CompoundIndex(name = "cveId", def = "{'cveId': 1}")
public class TenantCve implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String cveId;

    private int devicesCount;

    private List<Long> affectedTitleIds;

    private Instant discoveredAt;

    private Instant updatedAt;
}
