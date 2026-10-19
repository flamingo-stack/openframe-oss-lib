package com.openframe.management.controller;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.management.dto.IntegratedToolView;
import com.openframe.management.hook.IntegratedToolPostSaveHook;
import com.openframe.debezium.service.DebeziumService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Slf4j
@RestController
@RequestMapping("/v1/tools")
@RequiredArgsConstructor
public class IntegratedToolController {

    private final IntegratedToolService toolService;
    private final DebeziumService debeziumService;
    private final TenantIdProvider tenantIdProvider;
    private final List<IntegratedToolPostSaveHook> postSaveHooks;

    @GetMapping
    public Map<String, Object> getTools() {
        return Map.of(
            "status", "success",
            "tools", toolService.getAllTools().stream()
                .map(IntegratedToolView::from)
                .collect(Collectors.toList())
        );
    }

    @GetMapping("/{id}")
    public Map<String, Object> getTool(@PathVariable String id) {
        return toolService.getTool(id)
            .map(tool -> Map.of("status", "success", "tool", (Object) IntegratedToolView.from(tool)))
            .orElse(Map.of("status", "error", "message", "Tool not found"));
    }

    @Data
    public static class SaveToolRequest {
        private IntegratedTool tool;
    }

    // Path variable is the tool KEY (e.g. "meshcentral-server"), not the Mongo _id. The _id is an
    // internal per-document UUID; tools are addressed by (tenantId, key).
    @PostMapping("/{key}")
    public ResponseEntity<Map<String, Object>> saveTool(
            @PathVariable String key,
            @RequestBody SaveToolRequest request) {
        try {
            String tenantId = tenantIdProvider.getTenantId();
            IntegratedTool savedTool = toolService.saveTool(key, tenantId, request.getTool());

            debeziumService.createOrUpdateDebeziumConnector(savedTool.getDebeziumConnectors());

            for (IntegratedToolPostSaveHook hook : postSaveHooks) {
                try {
                    hook.onToolSaved(key, savedTool);
                } catch (Exception hookEx) {
                    log.warn("Post-save hook failed for toolKey={}: {}", key, hookEx.getMessage(), hookEx);
                }
            }
            return ResponseEntity.ok(Map.of("status", "success", "tool", IntegratedToolView.from(savedTool)));
        } catch (Exception e) {
            log.error("Failed to save tool: {}", key, e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
