package com.openframe.data.document.toolagent;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@Document(collection = "integrated_tool_agents")
public class IntegratedToolAgent {

    @Id
    private String id;
    private String toolId;
    private String version;
    private SessionType sessionType;

    private List<ToolAgentAsset> assets;

    private List<String> installationCommandArgs;
    private List<String> runCommandArgs;
    private List<String> agentToolIdCommandArgs;
    private List<String> uninstallationCommandArgs;

    private boolean allowVersionUpdate;
    private boolean allowConfigurationUpdate;

    private ToolAgentStatus status;
    
}