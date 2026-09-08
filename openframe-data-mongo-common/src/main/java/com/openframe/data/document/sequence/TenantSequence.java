package com.openframe.data.document.sequence;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Per-tenant sequence counter. Isolated by tenantId like all other TenantScoped documents —
 * TenantAwareMongoTemplate auto-scopes all queries so no composite key is needed.
 * The "name" field identifies the sequence (e.g. "ticket_number") within a tenant.
 */
@Data
@Document(collection = "sequences")
@CompoundIndex(name = "tenant_name_idx", def = "{'tenantId': 1, 'name': 1}", unique = true)
public class TenantSequence implements TenantScoped {

    @Id
    private String id;

    private String tenantId;

    private String name;

    private int value;
}
