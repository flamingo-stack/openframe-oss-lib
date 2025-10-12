package com.openframe.data.model.nats;

import com.openframe.data.document.toolagent.FileType;
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
    private FileType fileType;
    private boolean requireGui;
    private List<String> installationCommandArgs;
    private List<String> runCommandArgs;
    private List<String> toolAgentIdCommandArgs;
    private List<String> uninstallationCommandArgs;
    private List<Asset> assets;

    @Getter
    @Setter
    public static class Asset {
        private String id;
        private String localFilename;
        private AssetSource source;
        private String path;
        private boolean executable;
    }

    public enum AssetSource {
        ARTIFACTORY, TOOL_API
    }

}
