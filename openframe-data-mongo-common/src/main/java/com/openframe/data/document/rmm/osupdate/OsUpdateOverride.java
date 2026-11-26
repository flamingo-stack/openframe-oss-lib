package com.openframe.data.document.rmm.osupdate;

import com.openframe.data.document.TenantScoped;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

// A technician's decision on one update, for one device, one customer or every customer, on top of what the
// policy says.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@Document(collection = "os_update_overrides")
@CompoundIndex(
        name = "tenant_identifier_organization_machine",
        def = "{'tenantId': 1, 'platform': 1, 'identifier': 1, 'organizationId': 1, 'machineId': 1}",
        unique = true)
public class OsUpdateOverride implements TenantScoped {

    @Id
    private String id;

    @Version
    private Long version;

    private String tenantId;

    private OsPlatform platform;

    private String identifier;

    private OsUpdateOverrideAction action;

    // At most one of the two is set; neither = every customer. The narrowest override that covers a device wins.
    private String organizationId;

    private String machineId;

    private String actedBy;

    private Instant actedAt;
}
