package com.openframe.data.document.installedagents;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "installed_agents")
public class InstalledAgent {

    @Id
    private String id;
    private String machineId;
    private String agentType;
    private String version;
    private String createdAt;
    private String updatedAt;

}
