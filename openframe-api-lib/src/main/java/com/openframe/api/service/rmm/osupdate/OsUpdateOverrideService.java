package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.service.device.DeviceService;
import com.openframe.audit.Audited;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverrideAction;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverrideRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.data.service.rmm.osupdate.DeviceOsUpdateRolloutStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.OS_UPDATE_OVERRIDE_REMOVE;
import static com.openframe.data.document.audit.AuditAction.OS_UPDATE_OVERRIDE_SET;

// A technician's Approve, Hold or Reject on one update, on top of what the policies say. Its scope is one device,
// one customer, or every customer when neither is named.
@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateOverrideService {

    private final TenantIdProvider tenantIdProvider;
    private final OsUpdateOverrideRepository osUpdateOverrideRepository;
    private final OsUpdateService osUpdateService;
    private final DeviceService deviceService;
    private final DeviceOsUpdateRolloutStateService deviceOsUpdateRolloutStateService;

    public List<OsUpdateOverride> listOverrides(String osUpdateId) {
        return findOverrides(osUpdateService.getOsUpdate(osUpdateId));
    }

    // Replaces the earlier override of the same scope.
    @Audited(action = OS_UPDATE_OVERRIDE_SET, targetId = "#osUpdateId", compare = false,
            organizationId = "#organizationId", deviceId = "#machineId", details = "action=#action")
    public OsUpdateOverride setOverride(String osUpdateId, OsUpdateOverrideAction action, String organizationId,
                                        String machineId, String actedBy) {
        OsUpdate osUpdate = osUpdateService.getOsUpdate(osUpdateId);
        verifyScope(organizationId, machineId);
        OsUpdateOverride osUpdateOverride = findOverride(osUpdate, organizationId, machineId)
                .orElseGet(() -> OsUpdateOverride.builder()
                        .tenantId(tenantIdProvider.getTenantId())
                        .platform(osUpdate.getPlatform())
                        .identifier(osUpdate.getIdentifier())
                        .organizationId(organizationId)
                        .machineId(machineId)
                        .build());
        osUpdateOverride.setAction(action);
        osUpdateOverride.setActedBy(actedBy);
        osUpdateOverride.setActedAt(Instant.now());
        OsUpdateOverride savedOsUpdateOverride = osUpdateOverrideRepository.save(osUpdateOverride);
        refreshRollout(machineId);
        return savedOsUpdateOverride;
    }

    // The policy decides again. False = there was no override of this scope.
    @Audited(action = OS_UPDATE_OVERRIDE_REMOVE, targetId = "#osUpdateId", compare = false,
            organizationId = "#organizationId", deviceId = "#machineId", condition = "#result")
    public boolean removeOverride(String osUpdateId, String organizationId, String machineId) {
        OsUpdate osUpdate = osUpdateService.getOsUpdate(osUpdateId);
        Optional<OsUpdateOverride> osUpdateOverride = findOverride(osUpdate, organizationId, machineId);
        if (osUpdateOverride.isEmpty()) {
            return false;
        }
        osUpdateOverrideRepository.delete(osUpdateOverride.get());
        refreshRollout(machineId);
        return true;
    }

    private void verifyScope(String organizationId, String machineId) {
        if (organizationId != null && machineId != null) {
            throw new ValidationException("An override names a customer or a device, not both");
        }
        if (machineId != null) {
            deviceService.verifyExists(machineId);
        }
    }

    // The devices follow the override at once, not with the next scheduled run.
    private void refreshRollout(String machineId) {
        if (machineId == null) {
            deviceOsUpdateRolloutStateService.refreshAll();
        } else {
            deviceOsUpdateRolloutStateService.refreshMachines(List.of(machineId));
        }
    }

    private Optional<OsUpdateOverride> findOverride(OsUpdate osUpdate, String organizationId, String machineId) {
        return findOverrides(osUpdate).stream()
                .filter(osUpdateOverride -> Objects.equals(osUpdateOverride.getOrganizationId(), organizationId))
                .filter(osUpdateOverride -> Objects.equals(osUpdateOverride.getMachineId(), machineId))
                .findFirst();
    }

    private List<OsUpdateOverride> findOverrides(OsUpdate osUpdate) {
        return osUpdateOverrideRepository.findByTenantIdAndPlatformAndIdentifier(
                tenantIdProvider.getTenantId(), osUpdate.getPlatform(), osUpdate.getIdentifier());
    }
}
