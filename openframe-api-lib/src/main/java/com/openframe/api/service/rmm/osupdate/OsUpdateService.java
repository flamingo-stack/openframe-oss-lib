package com.openframe.api.service.rmm.osupdate;

import com.openframe.api.dto.GenericQueryResult;
import com.openframe.api.dto.rmm.osupdate.DeviceOsStateResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateHistoryEntryResponse;
import com.openframe.api.dto.rmm.osupdate.DeviceOsUpdateResponse;
import com.openframe.api.dto.shared.CursorCodec;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.exception.DeviceNotFoundException;
import com.openframe.api.mapper.OsUpdateMapper;
import com.openframe.data.document.rmm.osupdate.DeviceOsUpdateHistoryEntry;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsStateRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateHistoryRepository;
import com.openframe.data.repository.rmm.osupdate.DeviceOsUpdateRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
@RequiredArgsConstructor
public class OsUpdateService {

    private final MachineRepository machineRepository;
    private final DeviceOsStateRepository deviceOsStateRepository;
    private final DeviceOsUpdateRepository deviceOsUpdateRepository;
    private final DeviceOsUpdateHistoryRepository deviceOsUpdateHistoryRepository;
    private final OsUpdateMapper osUpdateMapper;
    private final TenantIdProvider tenantIdProvider;

    public boolean hasStateForDevice(String machineId) {
        verifyDeviceExists(machineId);
        return deviceOsStateRepository.existsByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId);
    }

    public DeviceOsStateResponse getStateForDevice(String machineId) {
        return deviceOsStateRepository.findByTenantIdAndMachineId(tenantIdProvider.getTenantId(), machineId)
                .map(osUpdateMapper::toResponse)
                .orElseThrow(() -> new IllegalStateException("No OS state stored for device: " + machineId));
    }

    public List<DeviceOsUpdateResponse> listPendingForDevice(String machineId) {
        verifyDeviceExists(machineId);
        return deviceOsUpdateRepository
                .findByTenantIdAndMachineIdOrderByDiscoveredAtDescTitleAsc(tenantIdProvider.getTenantId(), machineId)
                .stream()
                .map(osUpdateMapper::toResponse)
                .toList();
    }

    public GenericQueryResult<DeviceOsUpdateHistoryEntryResponse> listHistoryForDevice(
            String machineId, CursorPaginationCriteria pagination) {
        verifyDeviceExists(machineId);
        CursorPaginationCriteria normalized = pagination.normalize();
        int limit = normalized.getLimit();

        List<DeviceOsUpdateHistoryEntry> fetched = deviceOsUpdateHistoryRepository.findPage(
                tenantIdProvider.getTenantId(), machineId, normalized.getCursor(), limit + 1);
        boolean hasMore = fetched.size() > limit;
        List<DeviceOsUpdateHistoryEntryResponse> items = fetched.stream()
                .limit(limit)
                .map(this::toResponse)
                .toList();

        String startCursor = items.isEmpty() ? null : items.getFirst().getCursor();
        String endCursor = items.isEmpty() ? null : items.getLast().getCursor();
        PageInfo pageInfo = PageInfo.builder()
                .hasNextPage(hasMore)
                .hasPreviousPage(normalized.hasCursor())
                .startCursor(startCursor)
                .endCursor(endCursor)
                .build();
        return GenericQueryResult.<DeviceOsUpdateHistoryEntryResponse>builder()
                .items(items)
                .pageInfo(pageInfo)
                .build();
    }

    private void verifyDeviceExists(String machineId) {
        if (machineRepository.findByMachineId(machineId).isEmpty()) {
            throw new DeviceNotFoundException("Device not found: " + machineId);
        }
    }

    private DeviceOsUpdateHistoryEntryResponse toResponse(DeviceOsUpdateHistoryEntry entry) {
        String rawCursor = deviceOsUpdateHistoryRepository.encodeCursor(entry);
        return osUpdateMapper.toResponse(entry, CursorCodec.encode(rawCursor));
    }
}
