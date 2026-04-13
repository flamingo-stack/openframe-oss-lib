package com.openframe.management.controller;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.tenant.TenantRepository;
import com.openframe.data.service.IntegratedToolService;
import com.openframe.management.hook.IntegratedToolPostSaveHook;
import com.openframe.management.service.DebeziumService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.springframework.http.HttpStatus.INTERNAL_SERVER_ERROR;

@Slf4j
@RestController
@RequestMapping("/v1/tools")
@RequiredArgsConstructor
public class IntegratedToolController {

    private final IntegratedToolService toolService;
    private final DebeziumService debeziumService;
    private final TenantRepository tenantRepository;
    private final List<IntegratedToolPostSaveHook> postSaveHooks;

    @GetMapping
    public Map<String, Object> getTools() {
        return Map.of(
            "status", "success",
            "tools", toolService.getAllTools()
        );
    }

    @GetMapping("/{id}")
    public Map<String, Object> getTool(@PathVariable String id) {
        return toolService.getTool(id)
            .map(tool -> Map.of("status", "success", "tool", tool))
            .orElse(Map.of("status", "error", "message", "Tool not found"));
    }

    @Data
    public static class SaveToolRequest {
        private IntegratedTool tool;
    }

    /**
     * Applies all stored Debezium connector configurations to Kafka Connect.
     * Called by TenantRegisteredEventHandler (via DebeziumConnectorRegistrationService)
     * after a new tenant is created, so connectors start only when a tenant exists.
     */
    @PostMapping("/apply-connectors")
    public ResponseEntity<Map<String, Object>> applyAllConnectors() {
        try {
            List<IntegratedTool> tools = toolService.getAllTools();
            int connectorCount = 0;
            for (IntegratedTool tool : tools) {
                if (tool.getDebeziumConnectors() != null && tool.getDebeziumConnectors().length > 0) {
                    log.info("Applying Debezium connectors for tool: {}", tool.getId());
                    debeziumService.createOrUpdateDebeziumConnector(tool.getDebeziumConnectors());
                    connectorCount += tool.getDebeziumConnectors().length;
                }
            }
            log.info("Applied {} Debezium connectors from {} tools", connectorCount, tools.size());
            return ResponseEntity.ok(Map.of("status", "success", "connectorsApplied", connectorCount));
        } catch (Exception e) {
            log.error("Failed to apply Debezium connectors", e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }

    @PostMapping("/{id}")
    public ResponseEntity<Map<String, Object>> saveTool(
            @PathVariable String id,
            @RequestBody SaveToolRequest request) {
        try {
            IntegratedTool tool = request.getTool();
            tool.setId(id);
            tool.setEnabled(true);

            IntegratedTool savedTool = toolService.saveTool(tool);
            log.info("Successfully saved tool configuration for: {}", id);

            // Defer Kafka Connect connector creation until a tenant is registered.
            // Pre-registration: tool + connector templates saved to MongoDB only.
            // Post-registration (redeploy/config change): apply to Kafka Connect immediately.
            if (tenantRepository.count() == 0) {
                log.info("No tenant registered yet — Debezium connectors saved to MongoDB, " +
                        "will be applied when tenant registers");
            } else {
                debeziumService.createOrUpdateDebeziumConnector(savedTool.getDebeziumConnectors());
            }

            for (IntegratedToolPostSaveHook hook : postSaveHooks) {
                try {
                    hook.onToolSaved(id, savedTool);
                } catch (Exception hookEx) {
                    log.warn("Post-save hook failed for toolId={}: {}", id, hookEx.getMessage(), hookEx);
                }
            }
            return ResponseEntity.ok(Map.of("status", "success", "tool", savedTool));
        } catch (Exception e) {
            log.error("Failed to save tool: {}", id, e);
            return ResponseEntity.status(INTERNAL_SERVER_ERROR)
                    .body(Map.of("status", "error", "message", e.getMessage()));
        }
    }
}
