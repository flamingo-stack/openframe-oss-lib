package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceScope;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.rmm.osupdate.OsUpdateSummaryResponse;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.device.DeviceService;
import com.openframe.api.service.shared.CursorPageAssembler;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRolloutStateRepository;
import com.openframe.data.repository.rmm.osupdate.ManageableOsDeviceCounts;
import com.openframe.data.repository.rmm.osupdate.OsUpdateOverdueDeviceCounts;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;
import java.util.function.Function;

import static org.springframework.util.CollectionUtils.isEmpty;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateDeviceService {

    private final OsUpdateService osUpdateService;
    private final DeviceOsPendingUpdateService deviceOsPendingUpdateService;
    private final DeviceOsUpdateHistoryService deviceOsUpdateHistoryService;
    private final DeviceService deviceService;
    private final CursorPageAssembler cursorPageAssembler;
    private final DeviceOsStateService deviceOsStateService;
    private final DeviceOsUpdateRolloutStateRepository deviceOsUpdateRolloutStateRepository;
    private final TenantIdProvider tenantIdProvider;

    // Each status reads its own collection, so a page never mixes the two. Only Windows reports a history.
    // Organizations: only their devices. Empty = every organization.
    public GenericQueryResult<OsUpdateDeviceResponse> listDevices(String osUpdateId, OsUpdateDeviceStatus status,
                                                                  List<String> organizationIds,
                                                                  CursorPaginationCriteria pagination) {
        OsUpdate osUpdate = osUpdateService.getOsUpdate(osUpdateId);
        CursorPaginationCriteria normalizedPagination = pagination.normalize();
        String cursor = normalizedPagination.getCursor();
        int fetchLimit = normalizedPagination.getLimit() + 1;
        List<String> scopeMachineIds = isEmpty(organizationIds)
                ? null
                : deviceService.findDeviceIdsOfOrganizations(organizationIds);
        List<OsUpdateDeviceResponse> fetchedDevices;
        if (status == OsUpdateDeviceStatus.PENDING) {
            fetchedDevices = deviceOsPendingUpdateService.listOsUpdateDevices(
                    osUpdate, scopeMachineIds, cursor, fetchLimit);
        } else if (osUpdate.getPlatform() == OsPlatform.WINDOWS) {
            fetchedDevices = deviceOsUpdateHistoryService.listOsUpdateDevices(
                    osUpdate.getIdentifier(), scopeMachineIds, cursor, fetchLimit);
        } else {
            fetchedDevices = List.of();
        }
        return cursorPageAssembler.toPage(fetchedDevices, normalizedPagination, Function.identity(),
                OsUpdateDeviceResponse::getCursor);
    }

    // Windows only: the policies are not applied to Macs. Devices we cannot manage are not counted.
    // organizationId null = every customer.
    public OsUpdateSummaryResponse getSummary(String organizationId) {
        String tenantId = tenantIdProvider.getTenantId();
        OsUpdateDeviceScope osUpdateDeviceScope =
                osUpdateService.findDeviceScope(organizationId == null ? List.of() : List.of(organizationId));
        ManageableOsDeviceCounts manageableOsDeviceCounts = deviceOsStateService.countManageableDevices(
                OsPlatform.WINDOWS, osUpdateDeviceScope.getMachineIds());
        Instant now = Instant.now();
        long installDueDeviceCount =
                deviceOsUpdateRolloutStateRepository.countDevicesWithInstallDue(tenantId, organizationId, now);
        OsUpdateOverdueDeviceCounts osUpdateOverdueDeviceCounts =
                deviceOsUpdateRolloutStateRepository.countOverdueDevices(tenantId, organizationId, now);
        long deviceCount = manageableOsDeviceCounts.getDeviceCount();
        return OsUpdateSummaryResponse.builder()
                .deviceCount(Math.toIntExact(deviceCount))
                .currentDeviceCount(Math.toIntExact(Math.max(0, deviceCount - installDueDeviceCount)))
                .overdueDeviceCount(Math.toIntExact(osUpdateOverdueDeviceCounts.getDeviceCount()))
                .overdueOfflineDeviceCount(Math.toIntExact(osUpdateOverdueDeviceCounts.getOfflineDeviceCount()))
                .restartPendingDeviceCount(Math.toIntExact(manageableOsDeviceCounts.getRebootPendingDeviceCount()))
                .heldUpdateCount(osUpdateService.countHeldOsUpdates(osUpdateDeviceScope))
                .build();
    }
}
