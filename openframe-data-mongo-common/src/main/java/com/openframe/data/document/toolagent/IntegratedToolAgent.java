package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import com.openframe.data.document.clientconfiguration.PublishState;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.Version;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.List;

@Data
@Document(collection = "integrated_tool_agents")
public class IntegratedToolAgent {

    @Id
    private String id;

    @Version
    private Long documentVersion;

    private String toolId;

    private boolean releaseVersion;
    private String version;

    private SessionType sessionType;

    private List<DownloadConfiguration> downloadConfigurations;
    private List<ToolAgentAsset> assets;

    private List<String> installationCommandArgs;
    private List<String> runCommandArgs;
    private List<String> agentToolIdCommandArgs;
    private List<String> uninstallationCommandArgs;

    private ToolAgentStatus status;

    private PublishState publishState;

}