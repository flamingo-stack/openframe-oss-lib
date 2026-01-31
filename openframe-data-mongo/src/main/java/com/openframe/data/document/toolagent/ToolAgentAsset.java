package com.openframe.data.document.toolagent;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class ToolAgentAsset {
    
    private String id;
    private List<LocalFilenameConfiguration> localFilenameConfiguration;
    private ToolAgentAssetSource source;
    private String path;
    private boolean executable;
    
}