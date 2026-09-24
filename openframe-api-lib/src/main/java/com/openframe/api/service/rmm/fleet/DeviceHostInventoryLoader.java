package com.openframe.api.service.rmm.fleet;

import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

import static org.apache.commons.lang3.StringUtils.firstNonBlank;
import static org.apache.commons.lang3.StringUtils.isNumeric;
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceHostInventoryLoader {

    private static final int SOFTWARE_FETCH_PAGE = 500;
    private static final int SOFTWARE_FETCH_CAP = 5000;

    private final DeviceService deviceService;
    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;
    private final CorrelatedHostSoftwareCache hostSoftwareCache;
    private final ToolConnectionRepository toolConnectionRepository;

    public HostInventory load(FleetMdmClient fleet, String machineId) {
        Machine machine = requireMachine(machineId);
        return findHostId(fleet, machine)
                .map(hostId -> loadInventory(fleet, hostId))
                .orElseGet(HostInventory::empty);
    }

    private Machine requireMachine(String machineId) {
        return deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new NotFoundException("Device not found: " + machineId));
    }

    private Optional<Long> findHostId(FleetMdmClient fleet, Machine machine) {
        return connectedHostId(machine).or(() -> searchHostId(fleet, machine));
    }

    private Optional<Long> connectedHostId(Machine machine) {
        return toolConnectionRepository.findByMachineIdAndToolType(machine.getMachineId(), ToolType.FLEET_MDM)
                .map(ToolConnection::getAgentToolId)
                .filter(agentToolId -> isNumeric(agentToolId))
                .map(Long::valueOf);
    }

    private Optional<Long> searchHostId(FleetMdmClient fleet, Machine machine) {
        String lookupKey = firstNonBlank(machine.getOsUuid(), machine.getSerialNumber(), machine.getHostname());
        if (!hasText(lookupKey)) {
            return Optional.empty();
        }
        List<Host> candidates = fleet.searchHosts(lookupKey);
        String tenantId = tenantIdProvider.getTenantId();
        Map<Long, Machine> machinesByHostId = hostMachineResolver.resolve(tenantId, candidates);
        Optional<Long> hostId = machinesByHostId.entrySet().stream()
                .filter(entry -> isSameMachine(entry.getValue(), machine))
                .map(Map.Entry::getKey)
                .findFirst();
        if (hostId.isEmpty()) {
            log.debug("No Fleet host correlates to machineId={}", machine.getMachineId());
        }
        return hostId;
    }

    private static boolean isSameMachine(Machine candidate, Machine machine) {
        return Objects.equals(candidate.getMachineId(), machine.getMachineId());
    }

    private HostInventory loadInventory(FleetMdmClient fleet, long hostId) {
        List<HostSoftwareTitle> titles = fetchAllTitles(fleet, hostId);
        List<FleetSoftware> hostSoftware = correlatedSoftwareOf(fleet, hostId);
        return HostInventory.of(titles, hostSoftware);
    }

    private List<FleetSoftware> correlatedSoftwareOf(FleetMdmClient fleet, long hostId) {
        Map<Long, List<FleetSoftware>> softwareByHostId = hostSoftwareCache.softwareByHostId(fleet::searchHosts);
        return softwareByHostId.getOrDefault(hostId, List.of());
    }

    private static List<HostSoftwareTitle> fetchAllTitles(FleetMdmClient fleet, long hostId) {
        List<HostSoftwareTitle> all = new ArrayList<>();
        int page = 0;
        while (all.size() < SOFTWARE_FETCH_CAP) {
            HostSoftwareResponse response = fleet.listHostSoftware(hostId, page, SOFTWARE_FETCH_PAGE);
            if (isExhausted(response)) {
                break;
            }
            all.addAll(response.getSoftware());
            if (isLastPage(response)) {
                break;
            }
            page++;
        }
        return all;
    }

    private static boolean isExhausted(HostSoftwareResponse response) {
        return response == null || isEmpty(response.getSoftware());
    }

    private static boolean isLastPage(HostSoftwareResponse response) {
        return response.getMeta() == null || !Boolean.TRUE.equals(response.getMeta().getHasNextResults());
    }
}
