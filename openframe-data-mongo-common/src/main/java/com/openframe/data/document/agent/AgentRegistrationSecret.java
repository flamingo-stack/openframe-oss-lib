package com.openframe.data.document.agent;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "agent_registration_secrets")
@CompoundIndex(name = "tenant_secretKey_idx", def = "{'tenantId': 1, 'secretKey': 1}", unique = true)
public class AgentRegistrationSecret implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String secretKey;

    private Instant createdAt;

    private boolean active;

}
