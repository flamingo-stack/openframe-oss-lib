package com.openframe.data.document.tool;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ToolUrl {
    private String url;
    private String port;
    private ToolUrlType type;
} 