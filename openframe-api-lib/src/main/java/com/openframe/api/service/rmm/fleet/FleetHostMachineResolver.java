package com.openframe.api.service.rmm.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.apache.commons.lang3.StringUtils.isNotBlank;

@Component
@ConditionalOnProperty(name = "openframe.rmm.software.enabled", havingValue = "true")
@RequiredArgsConstructor
public class FleetHostMachineResolver {

    private final MachineRepository machineRepository;

    public Map<Long, Machine> resolve(String tenantId, List<Host> hosts) {
        if (hosts == null || hosts.isEmpty()) {
            return Map.of();
        }
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
            Machine machine = lookup(byOsUuid, host.getUuid());
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

    private static Set<String> values(List<Host> hosts, Function<Host, String> key) {
        return hosts.stream().map(key).filter(v -> isNotBlank(v)).collect(Collectors.toSet());
    }

    private static Map<String, Machine> index(List<Machine> machines, Function<Machine, String> key) {
        return machines.stream()
                .filter(m -> isNotBlank(key.apply(m)))
                .collect(Collectors.toMap(key, Function.identity(), (a, b) -> a));
    }

    private static Machine lookup(Map<String, Machine> byKey, String key) {
        return isNotBlank(key) ? byKey.get(key) : null;
    }
}
