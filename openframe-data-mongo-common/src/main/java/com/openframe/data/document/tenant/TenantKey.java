package com.openframe.data.document.tenant;
import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import java.time.Instant;
@Data
@Document(collection = "tenant_keys")
@CompoundIndex(
        name = "tenant_keys_tenant_active_unique",
        def = "{'tenantId': 1, 'active': 1}",
        unique = true,
        partialFilter = "{ 'active': true }"
)
public class TenantKey implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    private String keyId;
    private String publicPem;
    private String privateEncrypted;
    private boolean active;
    @CreatedDate
    private Instant createdAt;
    @LastModifiedDate
    private Instant rotatedAt;
}
