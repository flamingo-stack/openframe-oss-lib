package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusKind;
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
import java.util.Optional;
import java.util.Set;

import static java.util.stream.Collectors.toSet;

/**
 * Archives the client tickets a device opened under a previous customer once the device belongs to another one.
 * A client ticket keeps the customer it was opened under in its owner ({@code owner.organizationId}); when the
 * machine's current organization differs, the ticket is moved to the tenant's ARCHIVED status. Tickets without a
 * snapshot, admin tickets and tickets already archived are left alone, and so is everything when the machine has
 * no organization or the tenant has no ARCHIVED status.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MachineOnClientTicketsProjection implements Projection<MachineEvent, TicketClientOwnerView> {

    private static final String NAME = "machine-on-client-tickets";

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
        Optional<String> archivedStatusId = archivedStatusId(tenantId, event);
        if (archivedStatusId.isEmpty()) {
            return;
        }
        long archived = ticketProjectionRepository.archiveClientTicketsOfOtherOrganizations(
                tenantId, event.getMachineId(), event.getOrganizationId(), archivedStatusId.get());
        log.debug("{} archived {} ticket(s) of machine {} opened under a previous customer of tenant {}",
                NAME, archived, event.getMachineId(), tenantId);
    }

    @Override
    public long countChanges(PublishedRecord<MachineEvent> record, int limit) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        if (archivedStatusId(tenantId, event).isEmpty()) {
            return 0;
        }
        return ticketProjectionRepository.countClientTicketsOfOtherOrganizations(
                tenantId, event.getMachineId(), event.getOrganizationId(), limit);
    }

    @Override
    public String applyBatch(PublishedRecord<MachineEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        MachineEvent event = record.getEvent();
        Optional<String> archivedStatusId = archivedStatusId(tenantId, event);
        if (archivedStatusId.isEmpty()) {
            return null;
        }
        return ticketProjectionRepository.archiveClientTicketsOfOtherOrganizationsBatch(
                tenantId, event.getMachineId(), event.getOrganizationId(), archivedStatusId.get(), lastId, batchSize);
    }

    @Override
    public Class<Ticket> projectedClass() {
        return Ticket.class;
    }

    @Override
    public Class<TicketClientOwnerView> projectedViewClass() {
        return TicketClientOwnerView.class;
    }

    @Override
    public ReconciliationResult reconcile(List<TicketClientOwnerView> projectedItems) {
        List<TicketClientOwnerView> candidates = projectedItems.stream()
                .filter(MachineOnClientTicketsProjection::isOpenClientTicketWithSnapshot)
                .toList();
        if (candidates.isEmpty()) {
            return ReconciliationResult.allMatch();
        }
        Set<String> tenantIds = candidates.stream().map(TicketClientOwnerView::getTenantId).collect(toSet());
        Set<String> machineIds = candidates.stream().map(ticket -> clientOwner(ticket).getMachineId()).collect(toSet());
        Map<TenantScopedId, Machine> machines = findMachines(tenantIds, machineIds);
        List<Mismatch> mismatches = candidates.stream()
                .map(ticket -> toMismatch(ticket, machines))
                .filter(Objects::nonNull)
                .toList();
        return new ReconciliationResult(mismatches);
    }

    // A machine without an organization archives nothing, and neither does a tenant without an ARCHIVED status.
    private Optional<String> archivedStatusId(String tenantId, MachineEvent event) {
        if (event.getOrganizationId() == null) {
            return Optional.empty();
        }
        Optional<String> statusId = ticketProjectionRepository.findStatusId(tenantId, TicketStatusKind.ARCHIVED);
        if (statusId.isEmpty()) {
            log.warn("{} skipped machine {}: tenant {} has no ARCHIVED ticket status", NAME, event.getMachineId(), tenantId);
        }
        return statusId;
    }

    private static boolean isOpenClientTicketWithSnapshot(TicketClientOwnerView ticket) {
        return ticket.getStatusKind() != TicketStatusKind.ARCHIVED
                && ticket.getOwner() instanceof ClientTicketOwner owner
                && owner.getMachineId() != null
                && owner.getOrganizationId() != null;
    }

    private static ClientTicketOwner clientOwner(TicketClientOwnerView ticket) {
        return (ClientTicketOwner) ticket.getOwner();
    }

    // Every machine of the batch, in one query: its organization to compare, its _id to publish again.
    private Map<TenantScopedId, Machine> findMachines(Set<String> tenantIds, Set<String> machineIds) {
        Map<TenantScopedId, Machine> machines = new HashMap<>();
        for (Machine machine : machineRepository.findByTenantIdInAndMachineIdIn(tenantIds, machineIds)) {
            machines.put(new TenantScopedId(machine.getTenantId(), machine.getMachineId()), machine);
        }
        return machines;
    }

    // Null when the ticket still belongs to the machine's current customer, or the machine is gone.
    private static Mismatch toMismatch(TicketClientOwnerView ticket, Map<TenantScopedId, Machine> machines) {
        ClientTicketOwner owner = clientOwner(ticket);
        Machine machine = machines.get(new TenantScopedId(ticket.getTenantId(), owner.getMachineId()));
        if (machine == null || machine.getOrganizationId() == null
                || Objects.equals(machine.getOrganizationId(), owner.getOrganizationId())) {
            return null;
        }
        return new Mismatch(ticket.getTenantId(), ticket.getId(), machine.getId(),
                "opened under customer " + owner.getOrganizationId() + " but the device now belongs to "
                        + machine.getOrganizationId() + " and the ticket is not archived");
    }
}
