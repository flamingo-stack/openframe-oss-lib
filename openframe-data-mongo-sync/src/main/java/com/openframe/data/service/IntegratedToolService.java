package com.openframe.data.service;

import com.openframe.data.document.tool.IntegratedTool;
import com.openframe.data.repository.tool.IntegratedToolRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.integration.tool.enabled", havingValue = "true")
public class IntegratedToolService {

    private final IntegratedToolRepository toolRepository;

    public List<IntegratedTool> getAllTools() {
        return toolRepository.findAll();
    }

    public Optional<IntegratedTool> getTool(String toolType) {
        return toolRepository.findByType(toolType);
    }

    /**
     * Look up by human-readable key (e.g. "fleetmdm-server").
     * UNSCOPED: this bypasses tenant scoping and must only be used in single-tenant
     * (non-gateway) contexts. In multi-tenant gateway mode, callers must use
     * {@link #getToolByTenantAndKey(String, String)} instead. This method must not be
     * relied upon for tenant isolation; it does not perform any tenant scoping guard.
     *
     * @deprecated use {@link #getToolByTenantAndKey(String, String)} in any multi-tenant
     * gateway context; this method is retained only for single-tenant deployments.
     */
    @Deprecated
    public Optional<IntegratedTool> getToolByKey(String key) {
        return toolRepository.findByKey(key);
    }

    public Optional<IntegratedTool> getToolByTenantAndKey(String tenantId, String key) {
        return toolRepository.findByTenantIdAndKey(tenantId, key);
    }

    /** Look up by UUID _id — use only when you already hold the MongoDB document UUID. */
    public Optional<IntegratedTool> findByUuid(String uuid) {
        return toolRepository.findById(uuid);
    }

    public IntegratedTool saveTool(IntegratedTool tool) {
        return toolRepository.save(tool);
    }
}


