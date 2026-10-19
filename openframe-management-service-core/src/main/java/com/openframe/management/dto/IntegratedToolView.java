package com.openframe.management.dto;

import com.openframe.data.document.tool.IntegratedTool;
import lombok.Value;

@Value
public class IntegratedToolView {

    String id;
    String key;
    String tenantId;
    boolean enabled;

    public static IntegratedToolView from(IntegratedTool tool) {
        return new IntegratedToolView(
                tool.getId(),
                tool.getKey(),
                tool.getTenantId(),
                tool.isEnabled()
        );
    }
}
