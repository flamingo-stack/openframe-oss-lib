package com.openframe.data.service;

import java.util.List;
import java.util.NoSuchElementException;

import org.springframework.stereotype.Service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;

@Service
public class ToolUrlService {

    public boolean hasUrlForType(IntegratedTool integratedTool, ToolUrlType toolType) {
        List<ToolUrl> toolUrls = integratedTool.getToolUrls();
        return toolUrls.stream()
            .anyMatch(toolUrl -> toolUrl.getType().equals(toolType));
    }

    public ToolUrl getUrlByToolType(IntegratedTool integratedTool, ToolUrlType toolType) {
        List<ToolUrl> toolUrls = integratedTool.getToolUrls();
        return toolUrls.stream()
            .filter(toolUrl -> toolUrl.getType().equals(toolType))
            .findFirst()
            .orElseThrow(() -> new NoSuchElementException("No ToolUrl found for type: " + toolType));
    }
}



