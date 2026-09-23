package com.openframe.api.service.rmm.fleet;

import com.openframe.api.service.device.DeviceService;
import com.openframe.core.exception.NotFoundException;
import com.openframe.data.document.device.Machine;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.FleetSoftware;
import com.openframe.sdk.fleetmdm.model.Host;
import com.openframe.sdk.fleetmdm.model.HostSoftwareResponse;
import com.openframe.sdk.fleetmdm.model.HostSoftwareTitle;
import com.openframe.sdk.fleetmdm.model.HostVulnerabilityInventory;
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
import static org.springframework.util.CollectionUtils.isEmpty;
import static org.springframework.util.StringUtils.hasText;

@Slf4j
@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class DeviceHostInventoryLoader {

    private static final int SOFTWARE_FETCH_PAGE = 500;
    private static final int SOFTWARE_FETCH_CAP = 5000;

    private final FleetMdmClientProvider fleetClientProvider;
    private final DeviceService deviceService;
    private final FleetHostMachineResolver hostMachineResolver;
    private final TenantIdProvider tenantIdProvider;

    public HostInventory load(String machineId) {
        Machine machine = requireMachine(machineId);
        return findHostId(machine)
                .map(this::loadInventory)
                .orElseGet(HostInventory::empty);
    }

    private Machine requireMachine(String machineId) {
        return deviceService.findByMachineId(machineId)
                .orElseThrow(() -> new NotFoundException("Device not found: " + machineId));
    }

    private Optional<Long> findHostId(Machine machine) {
        String lookupKey = firstNonBlank(machine.getOsUuid(), machine.getSerialNumber(), machine.getHostname());
        if (!hasText(lookupKey)) {
            return Optional.empty();
        }
        List<Host> candidates = fleet().searchHosts(lookupKey);
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

    private HostInventory loadInventory(long hostId) {
        List<HostSoftwareTitle> titles = fetchAllTitles(hostId);
        List<FleetSoftware> hostSoftware = fetchHostSoftware(hostId);
        return HostInventory.of(titles, hostSoftware);
    }

    private List<HostSoftwareTitle> fetchAllTitles(long hostId) {
        List<HostSoftwareTitle> all = new ArrayList<>();
        int page = 0;
        while (all.size() < SOFTWARE_FETCH_CAP) {
            HostSoftwareResponse response = fleet().listHostSoftware(hostId, page, SOFTWARE_FETCH_PAGE);
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

    private List<FleetSoftware> fetchHostSoftware(long hostId) {
        HostVulnerabilityInventory host = fleet().getHostVulnerabilityInventoryById(hostId);
        return hasSoftware(host) ? host.software() : List.of();
    }

    private static boolean hasSoftware(HostVulnerabilityInventory host) {
        return host != null && !isEmpty(host.software());
    }

    private FleetMdmClient fleet() {
        return fleetClientProvider.client();
    }
}
