package com.openframe.data.document.toolagent;

import com.openframe.data.document.tool.ToolType;
import lombok.Value;

@Value
public class UnsupportedTool {

    String toolAgentId;
    ToolType toolType;
    String minOsVersion;
    String osVersion;
}
