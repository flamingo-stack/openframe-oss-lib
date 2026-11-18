package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.model.TenantScopedId;
import com.openframe.publishing.api.spec.Projection;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

// The device name every ticket keeps (deviceHostname, by deviceId): the nickname, else the hostname, as everywhere else.
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
        String deviceName = event.preferredName();
        long updated = ticketProjectionRepository.updateDeviceHostname(tenantId, machineId, deviceName);
        log.debug("{} set the name of machine {} on {} ticket(s) of tenant {}", NAME, machineId, updated, tenantId);
    }

    @Override
    public long countChanges(PublishedRecord<MachineEvent> record, int limit) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        String machineId = event.getMachineId();
        String deviceName = event.preferredName();
        return ticketProjectionRepository.countTicketsToUpdateDeviceHostname(tenantId, machineId, deviceName, limit);
    }

    @Override
    public String applyBatch(PublishedRecord<MachineEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        String machineId = event.getMachineId();
        String deviceName = event.preferredName();
        return ticketProjectionRepository.updateDeviceHostnameBatch(tenantId, machineId, deviceName, lastId, batchSize);
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
        Map<TenantScopedId, Machine> machines = findMachines(tenantIds, machineIds);

        List<Mismatch> mismatches = withDevice.stream()
            .map(ticket -> toMismatch(ticket, machines))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // Every machine of the batch, in one query: its name to compare, its _id to publish again.
    private Map<TenantScopedId, Machine> findMachines(Set<String> tenantIds, Set<String> machineIds) {
        Map<TenantScopedId, Machine> machines = new HashMap<>();
        for (Machine machine : machineRepository.findByTenantIdInAndMachineIdIn(tenantIds, machineIds)) {
            String tenantId = machine.getTenantId();
            String machineId = machine.getMachineId();
            TenantScopedId key = new TenantScopedId(tenantId, machineId);
            machines.put(key, machine);
        }
        return machines;
    }

    // Null when the copy matches its machine.
    private static Mismatch toMismatch(TicketDeviceView ticket, Map<TenantScopedId, Machine> machines) {
        String tenantId = ticket.getTenantId();
        String ticketId = ticket.getId();
        String machineId = ticket.getDeviceId();
        TenantScopedId key = new TenantScopedId(tenantId, machineId);
        Machine machine = machines.get(key);
        // The copy is kept when its source is deleted, so a source that is gone leaves no mismatch.
        if (machine == null) {
            return null;
        }
        String sourceName = machine.preferredName();
        String copiedName = ticket.getDeviceHostname();
        if (Objects.equals(sourceName, copiedName)) {
            return null;
        }
        String sourceId = machine.getId();
        return new Mismatch(tenantId, ticketId, sourceId,
            "device name \"" + copiedName + "\" differs from machine's \"" + sourceName + "\"");
    }
}
