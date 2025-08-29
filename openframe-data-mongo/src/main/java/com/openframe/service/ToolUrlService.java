package com.openframe.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.openframe.document.tool.IntegratedTool;
import com.openframe.document.tool.ToolUrl;
import com.openframe.document.tool.ToolUrlType;

@Service
public class ToolUrlService {

    public Optional<ToolUrl> getUrlByToolType(IntegratedTool integratedTool, ToolUrlType toolType) {
        List<ToolUrl> toolUrls = integratedTool.getToolUrls();
        return toolUrls.stream()
            .filter(toolUrl -> toolUrl.getType().equals(toolType))
            .findFirst();
    }

}


