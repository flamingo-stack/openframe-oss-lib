package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.model.ReconciliationResult;
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

// The organization name every ticket keeps in organizationName; TicketCascadeAspect writes it until the mode is events.
@Slf4j
@Component
@RequiredArgsConstructor
public class OrganizationOnTicketsProjection implements Projection<OrganizationEvent, TicketOrganizationView> {

    private static final String NAME = "organization-on-tickets";

    private final OrganizationRepository organizationRepository;
    private final TicketProjectionRepository ticketProjectionRepository;

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public void apply(PublishedRecord<OrganizationEvent> record) {
        String tenantId = record.getTenantId();
        OrganizationEvent event = record.getEvent();
        String organizationId = event.getOrganizationId();
        String name = event.getName();
        long updated = ticketProjectionRepository.updateOrganizationName(tenantId, organizationId, name);
        log.debug("{} set the name of organization {} on {} ticket(s) of tenant {}", NAME, organizationId, updated, tenantId);
    }

    @Override
    public Class<Ticket> projectedClass() {
        return Ticket.class;
    }

    @Override
    public Class<TicketOrganizationView> projectedViewClass() {
        return TicketOrganizationView.class;
    }

    @Override
    public ReconciliationResult reconcile(List<TicketOrganizationView> projectedItems) {
        List<TicketOrganizationView> withOrganization = projectedItems.stream()
            .filter(ticket -> ticket.getOrganizationId() != null)
            .toList();

        if (withOrganization.isEmpty()) {
            return ReconciliationResult.allMatch();
        }

        Map<TenantOrganization, String> organizationNames = organizationNames(withOrganization);

        List<Mismatch> mismatches = withOrganization.stream()
            .map(ticket -> mismatchOf(ticket, organizationNames))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // The current name of every organization of the batch, in one query.
    private Map<TenantOrganization, String> organizationNames(List<TicketOrganizationView> tickets) {
        Set<String> tenantIds = tickets.stream().map(TicketOrganizationView::getTenantId).collect(toSet());
        Set<String> organizationIds = tickets.stream().map(TicketOrganizationView::getOrganizationId).collect(toSet());

        List<Organization> organizations = organizationRepository.findByTenantIdInAndOrganizationIdIn(tenantIds, organizationIds);

        return organizations.stream()
            .collect(
                HashMap::new,
                (acc, org) -> acc.put(buildTenantOrganization(org), org.getName()),
                HashMap::putAll);
    }

    private static TenantOrganization buildTenantOrganization(Organization organization) {
        String tenantId = organization.getTenantId();
        String organizationId = organization.getOrganizationId();
        return new TenantOrganization(tenantId, organizationId);
    }

    private static Mismatch mismatchOf(TicketOrganizationView ticket, Map<TenantOrganization, String> organizationNames) {
        String tenantId = ticket.getTenantId();
        String organizationId = ticket.getOrganizationId();
        String ticketId = ticket.getId();
        TenantOrganization key = new TenantOrganization(tenantId, organizationId);
        if (!organizationNames.containsKey(key)) {
            return new Mismatch(tenantId, ticketId, "organization " + organizationId + " is gone");
        }
        String sourceName = organizationNames.get(key);
        String copiedName = ticket.getOrganizationName();
        if (Objects.equals(sourceName, copiedName)) {
            return null;
        }
        return new Mismatch(tenantId, ticketId, "name \"" + copiedName + "\" differs from organization's \"" + sourceName + "\"");
    }

    // A tenant's organization: an organizationId is unique only inside its tenant.
    @Getter
    @EqualsAndHashCode
    @AllArgsConstructor
    private static final class TenantOrganization {

        private final String tenantId;
        private final String organizationId;
    }
}
