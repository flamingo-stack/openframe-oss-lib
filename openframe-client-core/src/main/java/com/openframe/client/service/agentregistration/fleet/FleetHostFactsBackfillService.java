package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.DeviceStatus;
import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Stream;

import static java.util.stream.Collectors.toMap;
import static org.apache.commons.lang3.StringUtils.isNumeric;

// Machines registered before Fleet facts were stored, and machines whose facts went missing since: at most
// MACHINES_PER_RUN Fleet host reads per run, for connected Fleet hosts whose machine is missing any fact Fleet can fill
// (serial, computer name, model, manufacturer, OS UUID). Every completed Fleet read is stamped on the machine (a read
// that threw is not), and a machine is tried again only once the stamp is older than recheck-after, so machines
// Fleet cannot fill either (a VM without a serial) do not use up the runs, across restarts and pods alike.
@Service
@RequiredArgsConstructor
@Slf4j
public class FleetHostFactsBackfillService {

    static final String BEFORE_FIRST_CONNECTION = "000000000000000000000000";
    static final int MACHINES_PER_RUN = 200;

    private static final Set<DeviceStatus> RETIRED_STATUSES =
            EnumSet.of(DeviceStatus.PENDING_DELETION, DeviceStatus.DELETED, DeviceStatus.ARCHIVED);

    private final ToolConnectionRepository toolConnectionRepository;
    private final MachineRepository machineRepository;
    private final FleetMdmClients fleetMdmClients;
    private final FleetHostFactsWriter fleetHostFactsWriter;

    @Value("${openframe.fleet.host-facts.backfill.recheck-after:7d}")
    private Duration recheckAfter;

    public void backfill() {
        Instant now = Instant.now();
        List<PendingHost> hosts = pendingHosts(now.minus(recheckAfter));
        if (hosts.isEmpty()) {
            log.debug("Fleet host facts backfill: no machine missing Fleet facts that is due a check");
            return;
        }
        FleetMdmClient client = fleetMdmClients.client();
        int read = 0;
        for (PendingHost host : hosts) {
            HostRead outcome = fill(client, host);
            if (outcome == HostRead.FOUND) {
                read++;
            }
            // A read that threw is a transient failure, not an answer: the machine stays due, so a Fleet outage
            // does not push it back by recheck-after
            if (outcome != HostRead.FAILED) {
                machineRepository.markHostFactsChecked(host.machine().getMachineId(), now);
            }
        }
        log.info("Fleet host facts backfill: {} machines missing Fleet facts, {} Fleet hosts read", hosts.size(), read);
    }

    private List<PendingHost> pendingHosts(Instant checkedBefore) {
        List<PendingHost> hosts = new ArrayList<>();
        String cursor = BEFORE_FIRST_CONNECTION;
        Limit pageSize = Limit.of(MACHINES_PER_RUN);
        while (true) {
            List<ToolConnection> page = toolConnectionRepository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                    ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, cursor, pageSize);
            Map<String, Machine> machines = machinesOf(page);
            for (ToolConnection connection : page) {
                cursor = connection.getId();
                Machine machine = machines.get(connection.getMachineId());
                Long hostId = isDue(machine, checkedBefore) ? fleetHostId(connection) : null;
                if (hostId != null) {
                    hosts.add(new PendingHost(machine, hostId));
                }
                if (hosts.size() == MACHINES_PER_RUN) {
                    return hosts;
                }
            }
            if (page.size() < MACHINES_PER_RUN) {
                return hosts;
            }
        }
    }

    private Map<String, Machine> machinesOf(List<ToolConnection> page) {
        if (page.isEmpty()) {
            return Map.of();
        }
        List<String> machineIds = page.stream().map(ToolConnection::getMachineId).toList();
        List<Machine> machines = machineRepository.findByMachineIdIn(machineIds);
        return machines.stream()
                .collect(toMap(Machine::getMachineId, Function.identity(), (first, duplicate) -> first));
    }

    private static boolean isDue(Machine machine, Instant checkedBefore) {
        return machine != null
                && !RETIRED_STATUSES.contains(machine.getStatus())
                && isMissingFleetFacts(machine)
                && (machine.getHostFactsCheckedAt() == null || machine.getHostFactsCheckedAt().isBefore(checkedBefore));
    }

    // The facts FleetHostFactsWriter fills where blank
    private static boolean isMissingFleetFacts(Machine machine) {
        return Stream.of(machine.getSerialNumber(), machine.getComputerName(), machine.getModel(),
                        machine.getManufacturer(), machine.getOsUuid())
                .anyMatch(StringUtils::isBlank);
    }

    // A numeric agentToolId is the Fleet host id the transformer confirmed; a UUID there means Fleet never
    // confirmed the host, so there is nothing to read yet. A digit string too long for a host id is skipped the same
    // way, so it cannot stall the walk.
    private static Long fleetHostId(ToolConnection connection) {
        String agentToolId = connection.getAgentToolId();
        if (!isNumeric(agentToolId)) {
            return null;
        }
        try {
            return Long.parseLong(agentToolId);
        } catch (NumberFormatException e) {
            log.warn("Fleet host id out of range, skipped: connectionId={}, agentToolId={}", connection.getId(), agentToolId);
            return null;
        }
    }

    private HostRead fill(FleetMdmClient client, PendingHost pending) {
        Machine machine = pending.machine();
        long hostId = pending.hostId();
        try {
            Host host = client.getHostById(hostId);
            if (host == null) {
                log.debug("Fleet host {} of machine {} no longer exists", hostId, machine.getMachineId());
                return HostRead.GONE;
            }
            fleetHostFactsWriter.fill(machine, host);
            return HostRead.FOUND;
        } catch (Exception e) {
            log.warn("Fleet host facts backfill failed: machineId={}, host_id={}", machine.getMachineId(), hostId, e);
            return HostRead.FAILED;
        }
    }

    private enum HostRead {
        FOUND, GONE, FAILED
    }

    private record PendingHost(Machine machine, long hostId) {
    }
}
