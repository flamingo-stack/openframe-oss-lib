package com.openframe.debezium.recovery.gap;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.debezium.util.ConnectorSpecs;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.debezium.recovery.gap.enabled", havingValue = "true")
public class ToolConnectorSpecs {

    private final IntegratedToolService integratedToolService;

    public boolean hasSpec(String baseName) {
        return enabledSpecs().stream().anyMatch(spec -> isSpecOf(spec, baseName));
    }

    public Map<String, Object> specOf(String baseName) {
        return enabledSpecs().stream()
                .filter(spec -> isSpecOf(spec, baseName))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("No enabled connector spec for base: " + baseName));
    }

    private List<Map<String, Object>> enabledSpecs() {
        return integratedToolService.getAllTools().stream()
                .filter(IntegratedTool::isEnabled)
                .flatMap(ConnectorSpecs::specStreamOf)
                .toList();
    }

    private static boolean isSpecOf(Map<String, Object> spec, String baseName) {
        return baseName.equals(ConnectorSpecs.nameOf(spec));
    }
}
