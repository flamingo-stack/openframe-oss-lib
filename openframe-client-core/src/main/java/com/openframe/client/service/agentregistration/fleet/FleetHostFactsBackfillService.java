package com.openframe.client.service.agentregistration.fleet;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.tool.ConnectionStatus;
import com.openframe.data.document.tool.ToolConnection;
import com.openframe.data.document.tool.ToolType;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.tool.ToolConnectionRepository;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.sdk.fleetmdm.FleetMdmClient;
import com.openframe.sdk.fleetmdm.model.Host;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.apache.commons.lang3.StringUtils.isNumeric;

// Fills the hardware facts Fleet knows (serial, computer name, model, manufacturer, OS UUID) where the tool connection
// consumer did not: machines registered before Fleet facts were stored, a fill that failed, a host Fleet had no facts
// for yet. One query picks the machines missing a fact that are due a check, at most MACHINES_PER_RUN, so a run costs
// as much as the machines left to fill, not the fleet. Every completed Fleet read is stamped on the machine (a read
// that threw is not), and so is a machine without a confirmed Fleet host: a machine is tried again only once the stamp
// is older than recheck-after, so machines Fleet cannot fill (a VM without a serial) do not use up the runs.
@Service
@RequiredArgsConstructor
@Slf4j
public class FleetHostFactsBackfillService {

    static final int MACHINES_PER_RUN = 200;

    private final MachineRepository machineRepository;
    private final ToolConnectionRepository toolConnectionRepository;
    private final FleetMdmClients fleetMdmClients;
    private final FleetHostFactsWriter fleetHostFactsWriter;
    private final TenantIdProvider tenantIdProvider;

    @Value("${openframe.fleet.host-facts.backfill.recheck-after:7d}")
    private Duration recheckAfter;

    public void backfill() {
        Instant now = Instant.now();
        String tenantId = tenantIdProvider.getTenantId();
        List<Machine> due = machineRepository.findDueForFleetHostFacts(tenantId, now.minus(recheckAfter), MACHINES_PER_RUN);
        if (due.isEmpty()) {
            log.debug("Fleet host facts backfill: no machine missing Fleet facts that is due a check");
            return;
        }
        Map<String, Long> hostIds = fleetHostIds(tenantId, due);
        // Nothing to read yet: the tool connection consumer fills the machine once Fleet confirms its host
        List<Machine> withoutHost = due.stream()
                .filter(machine -> !hostIds.containsKey(machine.getMachineId()))
                .toList();
        withoutHost.forEach(machine -> machineRepository.markHostFactsChecked(machine.getMachineId(), now));
        int read = hostIds.isEmpty() ? 0 : readHosts(due, hostIds, now);
        log.info("Fleet host facts backfill: {} machines due, {} without a confirmed Fleet host, {} Fleet hosts read",
                due.size(), withoutHost.size(), read);
    }

    private int readHosts(List<Machine> due, Map<String, Long> hostIds, Instant now) {
        FleetMdmClient client = fleetMdmClients.client();
        int read = 0;
        for (Machine machine : due) {
            Long hostId = hostIds.get(machine.getMachineId());
            if (hostId == null) {
                continue;
            }
            HostRead outcome = fill(client, machine, hostId);
            if (outcome == HostRead.FOUND) {
                read++;
            }
            // A read that threw is a transient failure, not an answer: the machine stays due, so a Fleet outage
            // does not push it back by recheck-after
            if (outcome != HostRead.FAILED) {
                machineRepository.markHostFactsChecked(machine.getMachineId(), now);
            }
        }
        return read;
    }

    private Map<String, Long> fleetHostIds(String tenantId, List<Machine> machines) {
        List<String> machineIds = machines.stream().map(Machine::getMachineId).toList();
        List<ToolConnection> connections = toolConnectionRepository.findByTenantIdAndMachineIdInAndToolTypeAndStatus(
                tenantId, machineIds, ToolType.FLEET_MDM, ConnectionStatus.CONNECTED);
        Map<String, Long> hostIds = new HashMap<>();
        for (ToolConnection connection : connections) {
            Long hostId = fleetHostId(connection);
            if (hostId != null) {
                hostIds.putIfAbsent(connection.getMachineId(), hostId);
            }
        }
        return hostIds;
    }

    // A numeric agentToolId is the Fleet host id the transformer confirmed; a UUID there means Fleet never
    // confirmed the host, so there is nothing to read yet. A digit string too long for a host id is skipped the same
    // way.
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

    private HostRead fill(FleetMdmClient client, Machine machine, long hostId) {
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
}
