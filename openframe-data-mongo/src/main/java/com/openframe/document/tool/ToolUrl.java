package com.openframe.document.tool;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ToolUrl {
    private String url;
    private String port;
    private ToolUrlType type;
} 