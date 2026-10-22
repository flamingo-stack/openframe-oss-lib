package com.openframe.data.repository.organization.publishing;

import com.openframe.data.document.organization.Organization;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import com.openframe.publishing.api.model.ReconciliationResult;
import org.junit.jupiter.api.Test;
import org.springframework.data.mapping.PropertyHandler;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class OrganizationOnTicketsProjectionTest {

    private final OrganizationRepository organizationRepository = mock(OrganizationRepository.class);
    private final TicketProjectionRepository ticketProjectionRepository = mock(TicketProjectionRepository.class);
    private final OrganizationOnTicketsProjection projection = new OrganizationOnTicketsProjection(organizationRepository,
            ticketProjectionRepository);

    @Test
    void aTicketWithTheOrganizationsCurrentName_matches() {
        // setup
        when(organizationRepository.findByTenantIdInAndOrganizationIdIn(Set.of("tenant-a"), Set.of("org-1")))
                .thenReturn(List.of(organization("tenant-a", "org-1", "Acme")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(ticket("t1", "tenant-a", "org-1", "Acme")));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
    }

    @Test
    void aTicketWithAnOldName_andATicketWhoseOrganizationIsGone_areMismatches() {
        // setup
        when(organizationRepository.findByTenantIdInAndOrganizationIdIn(Set.of("tenant-a"), Set.of("org-1", "org-gone")))
                .thenReturn(List.of(organization("tenant-a", "org-1", "New name")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                ticket("t1", "tenant-a", "org-1", "Old name"),
                ticket("t2", "tenant-a", "org-gone", "Gone")));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t1", "t2");
        assertThat(result.getMismatches()).extracting(Mismatch::getTenantId).containsOnly("tenant-a");
        assertThat(result.getMismatches().get(0).getReason()).contains("Old name").contains("New name");
        assertThat(result.getMismatches().get(1).getReason()).contains("org-gone").contains("gone");
    }

    @Test
    void eachTicket_isMatchedWithTheOrganizationOfItsOwnTenant() {
        // setup
        when(organizationRepository.findByTenantIdInAndOrganizationIdIn(Set.of("tenant-a", "tenant-b"), Set.of("org-1")))
                .thenReturn(List.of(organization("tenant-a", "org-1", "Acme"), organization("tenant-b", "org-1", "Other")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                ticket("t1", "tenant-a", "org-1", "Acme"),
                ticket("t2", "tenant-b", "org-1", "Acme")));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t2");
    }

    @Test
    void ticketsWithoutAnOrganization_areSkipped_withoutAQuery() {
        // execution
        ReconciliationResult result = projection.reconcile(List.of(ticket("t1", "tenant-a", null, null)));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
        verify(organizationRepository, never()).findByTenantIdInAndOrganizationIdIn(any(), any());
    }

    @Test
    void theProjection_isNamedAndReadsTickets() {
        // verifications
        assertThat(projection.name()).isEqualTo("organization-on-tickets");
        assertThat(projection.projectedClass()).isEqualTo(Ticket.class);
        assertThat(projection.projectedViewClass()).isEqualTo(TicketOrganizationView.class);
    }

    @Test
    void anEvent_setsTheNameOnTheTicketsOfItsTenantAndOrganization() {
        // setup
        PublishedRecord<OrganizationEvent> record = record("tenant-a", "org-1", "New name");

        // execution
        projection.apply(record);

        // verifications
        verify(ticketProjectionRepository).updateOrganizationName("tenant-a", "org-1", "New name");
    }

    @Test
    void everyViewField_isATicketProperty_storedUnderTheSameName() {
        // setup
        MongoMappingContext mappingContext = new MongoMappingContext();
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MongoPersistentEntity<?> ticket = mappingContext.getRequiredPersistentEntity(Ticket.class);
        MongoPersistentEntity<?> view = mappingContext.getRequiredPersistentEntity(TicketOrganizationView.class);

        // execution and verifications
        view.doWithProperties((PropertyHandler<MongoPersistentProperty>) viewProperty -> {
            String name = viewProperty.getName();
            MongoPersistentProperty ticketProperty = ticket.getPersistentProperty(name);
            assertThat(ticketProperty).as(name).isNotNull();
            assertThat(viewProperty.getFieldName()).isEqualTo(ticketProperty.getFieldName());
        });
    }

    private static TicketOrganizationView ticket(String id, String tenantId, String organizationId, String organizationName) {
        return new TicketOrganizationView(id, tenantId, organizationId, organizationName);
    }

    private static PublishedRecord<OrganizationEvent> record(String tenantId, String organizationId, String name) {
        OrganizationEvent event = OrganizationEvent.builder().organizationId(organizationId).name(name).build();
        return PublishedRecord.<OrganizationEvent>builder().tenantId(tenantId).version(4L).schemaVersion(1).event(event).build();
    }

    private static Organization organization(String tenantId, String organizationId, String name) {
        Organization organization = Organization.builder().organizationId(organizationId).name(name).build();
        organization.setTenantId(tenantId);
        return organization;
    }
}
