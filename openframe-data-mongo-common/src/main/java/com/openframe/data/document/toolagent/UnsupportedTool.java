package com.openframe.data.document.toolagent;

import com.openframe.data.document.tool.ToolType;

public record UnsupportedTool(String toolAgentId, ToolType toolType, String minOsVersion, String osVersion) {
}
