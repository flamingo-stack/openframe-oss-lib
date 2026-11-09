package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.AdminTicketOwner;
import com.openframe.data.document.ticket.ClientTicketOwner;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketOwner;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.publishing.api.model.PublishedRecord;
import com.openframe.publishing.api.model.ReconciliationResult;
import com.openframe.publishing.api.model.ReconciliationResult.Mismatch;
import org.junit.jupiter.api.Test;
import org.springframework.data.mapping.PropertyHandler;
import org.springframework.data.mongodb.core.convert.MongoCustomConversions;
import org.springframework.data.mongodb.core.mapping.MongoMappingContext;
import org.springframework.data.mongodb.core.mapping.MongoPersistentEntity;
import org.springframework.data.mongodb.core.mapping.MongoPersistentProperty;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MachineOnClientTicketsProjectionTest {

    private static final String ARCHIVED_STATUS_ID = "status-archived";

    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final TicketProjectionRepository ticketProjectionRepository = mock(TicketProjectionRepository.class);
    private final MachineOnClientTicketsProjection projection = new MachineOnClientTicketsProjection(
            ticketProjectionRepository, machineRepository);

    @Test
    void anEvent_archivesTheClientTicketsOpenedUnderAnotherCustomer_intoTheTenantsArchivedStatus() {
        // setup
        when(ticketProjectionRepository.findStatusId("tenant-a", TicketStatusKind.ARCHIVED))
                .thenReturn(Optional.of(ARCHIVED_STATUS_ID));

        // execution
        projection.apply(buildRecord("tenant-a", "machine-1", "org-b"));

        // verifications
        verify(ticketProjectionRepository).archiveClientTicketsOfOtherOrganizations("tenant-a", "machine-1", "org-b",
                ARCHIVED_STATUS_ID);
    }

    @Test
    void aMachineWithoutAnOrganization_archivesNothing() {
        // execution
        projection.apply(buildRecord("tenant-a", "machine-1", null));

        // verifications
        verify(ticketProjectionRepository, never()).archiveClientTicketsOfOtherOrganizations(any(), any(), any(), any());
        assertThat(projection.countChanges(buildRecord("tenant-a", "machine-1", null), 100)).isZero();
    }

    @Test
    void aTenantWithoutAnArchivedStatus_archivesNothing() {
        // setup
        when(ticketProjectionRepository.findStatusId("tenant-a", TicketStatusKind.ARCHIVED)).thenReturn(Optional.empty());

        // execution
        projection.apply(buildRecord("tenant-a", "machine-1", "org-b"));

        // verifications
        verify(ticketProjectionRepository, never()).archiveClientTicketsOfOtherOrganizations(any(), any(), any(), any());
        assertThat(projection.applyBatch(buildRecord("tenant-a", "machine-1", "org-b"), null, 100)).isNull();
    }

    @Test
    void theChanges_areCounted_andWrittenInBatches() {
        // setup
        PublishedRecord<MachineEvent> record = buildRecord("tenant-a", "machine-1", "org-b");
        when(ticketProjectionRepository.findStatusId("tenant-a", TicketStatusKind.ARCHIVED))
                .thenReturn(Optional.of(ARCHIVED_STATUS_ID));
        when(ticketProjectionRepository.countClientTicketsOfOtherOrganizations("tenant-a", "machine-1", "org-b", 5000))
                .thenReturn(5000L);
        when(ticketProjectionRepository.archiveClientTicketsOfOtherOrganizationsBatch("tenant-a", "machine-1", "org-b",
                ARCHIVED_STATUS_ID, "t5", 1000)).thenReturn("t9");

        // execution and verifications
        assertThat(projection.countChanges(record, 5000)).isEqualTo(5000L);
        assertThat(projection.applyBatch(record, "t5", 1000)).isEqualTo("t9");
    }

    @Test
    void anOpenTicketOfAPreviousCustomer_isAMismatch_butArchivedAdminAndGoneMachineTicketsAreNot() {
        // setup
        when(machineRepository.findByTenantIdInAndMachineIdIn(Set.of("tenant-a"), Set.of("machine-1", "machine-gone")))
                .thenReturn(List.of(buildMachine("tenant-a", "machine-1", "org-b")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                view("t1", TicketStatusKind.TECH_REQUIRED, new ClientTicketOwner("machine-1", "org-a")),
                view("t2", TicketStatusKind.TECH_REQUIRED, new ClientTicketOwner("machine-1", "org-b")),
                view("t3", TicketStatusKind.ARCHIVED, new ClientTicketOwner("machine-1", "org-a")),
                view("t4", TicketStatusKind.TECH_REQUIRED, new ClientTicketOwner("machine-1", null)),
                view("t5", TicketStatusKind.TECH_REQUIRED, new ClientTicketOwner("machine-gone", "org-a")),
                view("t6", TicketStatusKind.TECH_REQUIRED, new AdminTicketOwner("admin-1"))));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t1");
        assertThat(result.getMismatches()).extracting(Mismatch::getSourceId).containsExactly("doc-tenant-a");
    }

    @Test
    void ticketsWithoutAClientSnapshot_areSkipped_withoutAQuery() {
        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                view("t1", TicketStatusKind.TECH_REQUIRED, new ClientTicketOwner("machine-1", null)),
                view("t2", TicketStatusKind.TECH_REQUIRED, new AdminTicketOwner("admin-1"))));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
        verify(machineRepository, never()).findByTenantIdInAndMachineIdIn(any(), any());
    }

    @Test
    void everyViewField_isATicketProperty_storedUnderTheSameName() {
        // setup
        MongoMappingContext mappingContext = new MongoMappingContext();
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MongoPersistentEntity<?> ticket = mappingContext.getRequiredPersistentEntity(Ticket.class);
        MongoPersistentEntity<?> view = mappingContext.getRequiredPersistentEntity(TicketClientOwnerView.class);

        // execution and verifications
        assertThat(projection.name()).isEqualTo("machine-on-client-tickets");
        view.doWithProperties((PropertyHandler<MongoPersistentProperty>) viewProperty -> {
            String name = viewProperty.getName();
            MongoPersistentProperty ticketProperty = ticket.getPersistentProperty(name);
            assertThat(ticketProperty).as(name).isNotNull();
            assertThat(viewProperty.getFieldName()).isEqualTo(ticketProperty.getFieldName());
        });
    }

    private static TicketClientOwnerView view(String id, TicketStatusKind kind, TicketOwner owner) {
        return new TicketClientOwnerView(id, "tenant-a", kind, owner);
    }

    private static Machine buildMachine(String tenantId, String machineId, String organizationId) {
        Machine machine = new Machine();
        machine.setId("doc-" + tenantId);
        machine.setTenantId(tenantId);
        machine.setMachineId(machineId);
        machine.setOrganizationId(organizationId);
        return machine;
    }

    private static PublishedRecord<MachineEvent> buildRecord(String tenantId, String machineId, String organizationId) {
        MachineEvent event = MachineEvent.builder().machineId(machineId).organizationId(organizationId).build();
        return PublishedRecord.<MachineEvent>builder().tenantId(tenantId).version(1).event(event).build();
    }
}
