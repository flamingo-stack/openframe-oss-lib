package com.openframe.stream.handler.software;

import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;

import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class FleetHostResolver {

    private final ToolConnectionRepository toolConnectionRepository;

    // a miss is not cached: the host may connect to OpenFrame a moment later
    @Cacheable(value = "fleetHostResolvable", key = "#fleetHostId", unless = "!#result")
    public boolean isResolvable(String fleetHostId) {
        return lookup(fleetHostId).isPresent();
    }

    @Cacheable(value = "fleetHostResolution", key = "#fleetHostId")
    public FleetHostRef resolve(String fleetHostId) {
        return lookup(fleetHostId)
                .orElseThrow(() -> new IllegalStateException("Fleet host " + fleetHostId + " is not connected to a machine"));
    }

    private Optional<FleetHostRef> lookup(String fleetHostId) {
        if (fleetHostId == null || fleetHostId.isBlank()) {
            return Optional.empty();
        }
        return toolConnectionRepository
                .findFirstByAgentToolIdAndToolTypeOrderByConnectedAtDesc(fleetHostId, ToolType.FLEET_MDM)
                .map(FleetHostResolver::toRef)
                .filter(ref -> ref.tenantId() != null && ref.machineId() != null);
    }

    private static FleetHostRef toRef(ToolConnection connection) {
        String tenantId = connection.getTenantId();
        String machineId = connection.getMachineId();
        return new FleetHostRef(tenantId, machineId);
    }

    public record FleetHostRef(String tenantId, String machineId) {}
}
