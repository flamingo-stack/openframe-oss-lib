package com.openframe.data.document.installedagents;

import com.openframe.data.document.TenantScoped;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "installed_agents")
public class InstalledAgent implements TenantScoped {

    @Id
    private String id;

    @Indexed
    private String tenantId;

    private String machineId;
    private String agentType;
    private String version;
    private String createdAt;
    private String updatedAt;

}
