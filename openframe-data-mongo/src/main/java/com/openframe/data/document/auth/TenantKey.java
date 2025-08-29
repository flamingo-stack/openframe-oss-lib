package com.openframe.data.document.auth;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "tenant_keys")
public class TenantKey {
    @Id
    private String id;
    private String tenantId;
    private String keyId;
    private String publicPem;
    private String privateEncrypted;
    private boolean active;
    private Instant createdAt;
    private Instant rotatedAt;
}


