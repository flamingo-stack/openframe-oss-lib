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
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Function;

import static java.util.stream.Collectors.toMap;
import static org.apache.commons.lang3.StringUtils.isBlank;
import static org.apache.commons.lang3.StringUtils.isNumeric;

// Machines registered before Fleet facts were stored, and machines whose facts went missing since: at most
// MACHINES_PER_RUN Fleet host reads per run, for connected Fleet hosts whose machine has no serial.
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

    // Where the previous run stopped, so machines Fleet cannot fill either (a host without a serial) do not hold
    // the rest back. In memory only: after a restart the walk begins again at the first connection.
    private final AtomicReference<String> resumeAfter = new AtomicReference<>(BEFORE_FIRST_CONNECTION);

    public void backfill() {
        String after = resumeAfter.get();
        Batch batch = nextBatch(after);
        resumeAfter.set(batch.nextCursor());
        List<PendingHost> hosts = batch.hosts();
        if (hosts.isEmpty()) {
            log.debug("Fleet host facts backfill: no machine without a serial after connection {}", after);
            return;
        }
        FleetMdmClient client = fleetMdmClients.client();
        int read = 0;
        for (PendingHost host : hosts) {
            if (fill(client, host)) {
                read++;
            }
        }
        log.info("Fleet host facts backfill: {} machines without a serial, {} Fleet hosts read", hosts.size(), read);
    }

    private Batch nextBatch(String after) {
        List<PendingHost> hosts = new ArrayList<>();
        String cursor = after;
        Limit pageSize = Limit.of(MACHINES_PER_RUN);
        while (true) {
            List<ToolConnection> page = toolConnectionRepository.findByToolTypeAndStatusAndIdGreaterThanOrderByIdAsc(
                    ToolType.FLEET_MDM, ConnectionStatus.CONNECTED, cursor, pageSize);
            Map<String, Machine> machines = machinesOf(page);
            for (ToolConnection connection : page) {
                cursor = connection.getId();
                Machine machine = machines.get(connection.getMachineId());
                Long hostId = isMissingFacts(machine) ? fleetHostId(connection) : null;
                if (hostId != null) {
                    hosts.add(new PendingHost(machine, hostId));
                }
                if (hosts.size() == MACHINES_PER_RUN) {
                    return new Batch(hosts, cursor);
                }
            }
            if (page.size() < MACHINES_PER_RUN) {
                return new Batch(hosts, BEFORE_FIRST_CONNECTION);
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

    private static boolean isMissingFacts(Machine machine) {
        return machine != null
                && !RETIRED_STATUSES.contains(machine.getStatus())
                && isBlank(machine.getSerialNumber());
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

    private boolean fill(FleetMdmClient client, PendingHost pending) {
        Machine machine = pending.machine();
        long hostId = pending.hostId();
        try {
            Host host = client.getHostById(hostId);
            if (host == null) {
                log.debug("Fleet host {} of machine {} no longer exists", hostId, machine.getMachineId());
                return false;
            }
            fleetHostFactsWriter.fill(machine, host);
            return true;
        } catch (Exception e) {
            log.warn("Fleet host facts backfill failed: machineId={}, host_id={}", machine.getMachineId(), hostId, e);
            return false;
        }
    }

    private record PendingHost(Machine machine, long hostId) {
    }

    private record Batch(List<PendingHost> hosts, String nextCursor) {
    }
}
