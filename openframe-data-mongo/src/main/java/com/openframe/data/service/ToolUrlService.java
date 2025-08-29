package com.openframe.data.service;

import java.util.List;
import java.util.Optional;

import org.springframework.stereotype.Service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.document.tool.ToolUrl;
import com.openframe.data.document.tool.ToolUrlType;

@Service
public class ToolUrlService {

    public Optional<ToolUrl> getUrlByToolType(IntegratedTool integratedTool, ToolUrlType toolType) {
        List<ToolUrl> toolUrls = integratedTool.getToolUrls();
        return toolUrls.stream()
            .filter(toolUrl -> toolUrl.getType().equals(toolType))
            .findFirst();
    }

}


