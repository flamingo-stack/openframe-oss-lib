package com.openframe.data.document.installedagents;
import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
@Data
@Document(collection = "user_installed_agents")
@CompoundIndex(name = "user_agent_type_idx", def = "{'userId': 1, 'agentType': 1}", unique = true)
public class UserInstalledAgent implements TenantScoped {
    @Id
    private String id;
    @Indexed
    private String tenantId;
    private String userId;
    private String agentType;
    private String version;
    private String createdAt;
    private String updatedAt;
}
