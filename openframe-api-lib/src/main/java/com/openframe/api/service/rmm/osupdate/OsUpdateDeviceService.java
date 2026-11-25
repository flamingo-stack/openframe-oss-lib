package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceResponse;
import com.openframe.api.dto.rmm.osupdate.OsUpdateDeviceStatus;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.service.device.DeviceService;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

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
}
