package com.openframe.stream.handler.software;

import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
@Slf4j
public class FleetHostResolver {

    private final ToolConnectionRepository toolConnectionRepository;

    @Cacheable(value = "fleetHostResolution", key = "#fleetHostId", unless = "#result == null")
    public FleetHostRef resolve(String fleetHostId) {
        if (fleetHostId == null || fleetHostId.isBlank()) {
            return null;
        }
        return toolConnectionRepository
                .findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc(fleetHostId, ToolType.FLEET_MDM)
                .map(tc -> new FleetHostRef(tc.getTenantId(), tc.getMachineId()))
                .filter(ref -> ref.tenantId() != null && ref.machineId() != null)
                .orElse(null);
    }

    public record FleetHostRef(String tenantId, String machineId) {}
}
