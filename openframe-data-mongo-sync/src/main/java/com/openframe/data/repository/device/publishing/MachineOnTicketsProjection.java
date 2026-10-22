package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.spec.Projection;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

// The hostname every ticket keeps for its device (deviceHostname, by deviceId); TicketCascadeAspect writes it until the
// mode is events.
@Slf4j
@Component
@RequiredArgsConstructor
public class MachineOnTicketsProjection implements Projection<MachineEvent, TicketDeviceView> {

    private static final String NAME = "machine-on-tickets";

    private final TicketProjectionRepository ticketProjectionRepository;
    private final MachineRepository machineRepository;

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public void apply(PublishedRecord<MachineEvent> record) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        String machineId = event.getMachineId();
        String hostname = event.getHostname();
        long updated = ticketProjectionRepository.updateDeviceHostname(tenantId, machineId, hostname);
        log.debug("{} set the hostname of machine {} on {} ticket(s) of tenant {}", NAME, machineId, updated, tenantId);
    }

    @Override
    public long countChanges(PublishedRecord<MachineEvent> record, int limit) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        String machineId = event.getMachineId();
        String hostname = event.getHostname();
        return ticketProjectionRepository.countTicketsToUpdateDeviceHostname(tenantId, machineId, hostname, limit);
    }

    @Override
    public String applyBatch(PublishedRecord<MachineEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        String machineId = event.getMachineId();
        String hostname = event.getHostname();
        return ticketProjectionRepository.updateDeviceHostnameBatch(tenantId, machineId, hostname, lastId, batchSize);
    }

    @Override
    public Class<Ticket> projectedClass() {
        return Ticket.class;
    }

    @Override
    public Class<TicketDeviceView> projectedViewClass() {
        return TicketDeviceView.class;
    }

    @Override
    public ReconciliationResult reconcile(List<TicketDeviceView> projectedItems) {
        List<TicketDeviceView> withDevice = projectedItems.stream()
            .filter(ticket -> ticket.getDeviceId() != null)
            .toList();

        if (withDevice.isEmpty()) {
            return ReconciliationResult.allMatch();
        }

        Set<String> tenantIds = withDevice.stream().map(TicketDeviceView::getTenantId).collect(toSet());
        Set<String> machineIds = withDevice.stream().map(TicketDeviceView::getDeviceId).collect(toSet());
        Map<TenantMachine, String> hostnames = findHostnames(tenantIds, machineIds);

        List<Mismatch> mismatches = withDevice.stream()
            .map(ticket -> toMismatch(ticket, hostnames))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // The current hostname of every machine of the batch, in one query.
    private Map<TenantMachine, String> findHostnames(Set<String> tenantIds, Set<String> machineIds) {
        Map<TenantMachine, String> hostnames = new HashMap<>();
        for (Machine machine : machineRepository.findByTenantIdInAndMachineIdIn(tenantIds, machineIds)) {
            String tenantId = machine.getTenantId();
            String machineId = machine.getMachineId();
            TenantMachine key = new TenantMachine(tenantId, machineId);
            String hostname = machine.getHostname();
            hostnames.put(key, hostname);
        }
        return hostnames;
    }

    // Null when the copy matches its machine.
    private static Mismatch toMismatch(TicketDeviceView ticket, Map<TenantMachine, String> hostnames) {
        String tenantId = ticket.getTenantId();
        String ticketId = ticket.getId();
        String machineId = ticket.getDeviceId();
        TenantMachine key = new TenantMachine(tenantId, machineId);
        if (!hostnames.containsKey(key)) {
            return new Mismatch(tenantId, ticketId, "machine " + machineId + " is gone");
        }
        String sourceHostname = hostnames.get(key);
        String copiedHostname = ticket.getDeviceHostname();
        if (Objects.equals(sourceHostname, copiedHostname)) {
            return null;
        }
        return new Mismatch(tenantId, ticketId,
            "hostname \"" + copiedHostname + "\" differs from machine's \"" + sourceHostname + "\"");
    }

    // A tenant's machine: a machineId is looked up inside its tenant.
    @Getter
    @EqualsAndHashCode
    @AllArgsConstructor
    private static final class TenantMachine {

        private final String tenantId;
        private final String machineId;
    }
}
