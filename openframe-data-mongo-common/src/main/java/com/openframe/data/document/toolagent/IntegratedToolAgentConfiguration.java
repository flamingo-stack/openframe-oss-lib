package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.Data;

import java.util.List;

@Data
public class IntegratedToolAgentConfiguration {

    private String id;
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

}
