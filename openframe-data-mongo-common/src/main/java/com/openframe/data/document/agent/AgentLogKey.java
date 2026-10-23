package com.openframe.data.document.agent;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

@Data
@Document(collection = "agent_log_keys")
public class AgentLogKey implements TenantScoped {

    @Id
    private String id;
    private String tenantId;

    private String encryptedKey;

    private Instant createdAt;

}
