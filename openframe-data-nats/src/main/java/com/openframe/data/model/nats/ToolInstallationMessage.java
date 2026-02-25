package com.openframe.data.model.nats;

import com.openframe.data.document.toolagent.SessionType;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ToolInstallationMessage {

    private String toolAgentId;
    private String toolId;
    private String toolType;
    private String version;
    private SessionType sessionType;
    private List<DownloadConfiguration> downloadConfigurations;
    private List<Asset> assets;

    private List<String> installationCommandArgs;
    private List<String> runCommandArgs;
    private List<String> toolAgentIdCommandArgs;
    private List<String> uninstallationCommandArgs;
    private boolean reinstall = false;

    @Getter
    @Setter
    public static class Asset {
        private String id;
        private String version;
        private List<DownloadConfiguration> downloadConfigurations;
        private List<LocalFilenameConfiguration> localFilenameConfiguration;
        private AssetSource source;
        private String path;
        private boolean executable;
    }
    
    @Getter
    @Setter
    public static class LocalFilenameConfiguration {
        private String filename;
        private String os;
    }

    public enum AssetSource {
        ARTIFACTORY, TOOL_API, GITHUB
    }

}
