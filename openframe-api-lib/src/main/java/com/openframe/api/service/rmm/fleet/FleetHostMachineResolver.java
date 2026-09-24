package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetHostMachineResolver {

    private static final Comparator<ToolConnection> NEWEST_FIRST =
            Comparator.comparing(ToolConnection::getConnectedAt, Comparator.nullsLast(Comparator.<Instant>reverseOrder()));

    private final MachineRepository machineRepository;
    private final ToolConnectionRepository toolConnectionRepository;

    public Map<Long, Machine> resolve(String tenantId, List<Host> hosts) {
        if (hosts == null || hosts.isEmpty()) {
            return Map.of();
        }
        Map<Long, Machine> byConnection = resolveByConnection(tenantId, hosts);
        Set<String> osUuids = values(hosts, Host::getUuid);
        Set<String> serials = values(hosts, Host::getHardwareSerial);
        Set<String> hostnames = values(hosts, Host::getHostname);

        Map<String, Machine> byOsUuid = index(machineRepository.findByTenantIdAndOsUuidIn(tenantId, osUuids), Machine::getOsUuid);
        Map<String, Machine> bySerial = index(machineRepository.findByTenantIdAndSerialNumberIn(tenantId, serials), Machine::getSerialNumber);
        Map<String, Machine> byHostname = index(machineRepository.findByTenantIdAndHostnameIn(tenantId, hostnames), Machine::getHostname);

        Map<Long, Machine> resolved = new LinkedHashMap<>();
        for (Host host : hosts) {
            if (host.getId() == null || resolved.containsKey(host.getId())) {
                continue;
            }
            Machine machine = byConnection.get(host.getId());
            if (machine == null) {
                machine = lookup(byOsUuid, host.getUuid());
            }
            if (machine == null) {
                machine = lookup(bySerial, host.getHardwareSerial());
            }
            if (machine == null) {
                machine = lookup(byHostname, host.getHostname());
            }
            if (machine != null) {
                resolved.put(host.getId(), machine);
            }
        }
        return resolved;
    }

    private Map<Long, Machine> resolveByConnection(String tenantId, List<Host> hosts) {
        List<String> hostIds = hostIds(hosts);
        List<ToolConnection> connections = toolConnectionRepository.findByAgentToolIdInAndToolType(hostIds, ToolType.FLEET_MDM);
        if (connections.isEmpty()) {
            return Map.of();
        }
        List<String> machineIds = connections.stream().map(ToolConnection::getMachineId).toList();
        List<Machine> machines = machineRepository.findByTenantIdAndMachineIdIn(tenantId, machineIds);
        Map<String, Machine> byMachineId = index(machines, Machine::getMachineId);
        Map<Long, Machine> byHostId = new HashMap<>();
        connections.stream()
                .sorted(NEWEST_FIRST)
                .forEach(connection -> claim(byHostId, connection, byMachineId));
        return byHostId;
    }

    private static List<String> hostIds(List<Host> hosts) {
        return hosts.stream()
                .map(Host::getId)
                .filter(Objects::nonNull)
                .map(String::valueOf)
                .toList();
    }

    private static void claim(Map<Long, Machine> byHostId, ToolConnection connection, Map<String, Machine> byMachineId) {
        Machine machine = byMachineId.get(connection.getMachineId());
        if (machine != null) {
            Long hostId = Long.valueOf(connection.getAgentToolId());
            byHostId.putIfAbsent(hostId, machine);
        }
    }

    private static Set<String> values(List<Host> hosts, Function<Host, String> key) {
        return hosts.stream().map(key).filter(v -> isNotBlank(v)).collect(Collectors.toSet());
    }

    private static Map<String, Machine> index(List<Machine> machines, Function<Machine, String> key) {
        return machines.stream()
                .filter(FleetHostMachineResolver::isCountable)
                .filter(m -> isNotBlank(key.apply(m)))
                .collect(Collectors.toMap(key, Function.identity(), (a, b) -> a));
    }

    private static boolean isCountable(Machine machine) {
        DeviceStatus status = machine.getStatus();
        return status == DeviceStatus.ONLINE || status == DeviceStatus.OFFLINE;
    }

    private static Machine lookup(Map<String, Machine> byKey, String key) {
        return isNotBlank(key) ? byKey.get(key) : null;
    }
}
