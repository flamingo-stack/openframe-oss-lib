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
    public long countChanges(PublishedRecord<OrganizationEvent> record, int limit) {
        String tenantId = record.getTenantId();
        OrganizationEvent event = record.getEvent();
        String organizationId = event.getOrganizationId();
        String name = event.getName();
        return ticketProjectionRepository.countOutdatedOrganizationNames(tenantId, organizationId, name, limit);
    }

    @Override
    public String applyBatch(PublishedRecord<OrganizationEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        OrganizationEvent event = record.getEvent();
        String organizationId = event.getOrganizationId();
        String name = event.getName();
        return ticketProjectionRepository.updateOrganizationNameBatch(tenantId, organizationId, name, lastId, batchSize);
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

        Map<TenantOrganization, Organization> organizations = findOrganizations(withOrganization);

        List<Mismatch> mismatches = withOrganization.stream()
            .map(ticket -> toMismatch(ticket, organizations))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // Every organization of the batch, in one query: its name to compare, its _id to publish again.
    private Map<TenantOrganization, Organization> findOrganizations(List<TicketOrganizationView> tickets) {
        Set<String> tenantIds = tickets.stream().map(TicketOrganizationView::getTenantId).collect(toSet());
        Set<String> organizationIds = tickets.stream().map(TicketOrganizationView::getOrganizationId).collect(toSet());

        List<Organization> organizations = organizationRepository.findByTenantIdInAndOrganizationIdIn(tenantIds, organizationIds);

        return organizations.stream()
            .collect(
                HashMap::new,
                (acc, org) -> acc.put(buildTenantOrganization(org), org),
                HashMap::putAll);
    }

    private static TenantOrganization buildTenantOrganization(Organization organization) {
        String tenantId = organization.getTenantId();
        String organizationId = organization.getOrganizationId();
        return new TenantOrganization(tenantId, organizationId);
    }

    private static Mismatch toMismatch(TicketOrganizationView ticket, Map<TenantOrganization, Organization> organizations) {
        String tenantId = ticket.getTenantId();
        String organizationId = ticket.getOrganizationId();
        String ticketId = ticket.getId();
        TenantOrganization key = new TenantOrganization(tenantId, organizationId);
        Organization organization = organizations.get(key);
        // The copy is kept when its source is deleted, so a source that is gone leaves no mismatch.
        if (organization == null) {
            return null;
        }
        String sourceName = organization.getName();
        String copiedName = ticket.getOrganizationName();
        if (Objects.equals(sourceName, copiedName)) {
            return null;
        }
        String sourceId = organization.getId();
        return new Mismatch(tenantId, ticketId, sourceId,
            "name \"" + copiedName + "\" differs from organization's \"" + sourceName + "\"");
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
