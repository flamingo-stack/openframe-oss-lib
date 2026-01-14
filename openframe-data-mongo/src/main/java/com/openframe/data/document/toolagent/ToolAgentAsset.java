package com.openframe.data.document.toolagent;

import com.openframe.data.document.clientconfiguration.DownloadConfiguration;
import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ToolAgentAsset {
    
    private String id;
    private String localFilename;
    private ToolAgentAssetSource source;
    private String path;
    private boolean executable;
    private String version;
    private List<DownloadConfiguration> downloadConfigurations;
    
}