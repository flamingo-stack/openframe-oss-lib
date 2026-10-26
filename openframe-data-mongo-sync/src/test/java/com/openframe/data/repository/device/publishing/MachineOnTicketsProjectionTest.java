package com.openframe.data.repository.device.publishing;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.ticket.Ticket;
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
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MachineOnTicketsProjectionTest {

    private final MachineRepository machineRepository = mock(MachineRepository.class);
    private final TicketProjectionRepository ticketProjectionRepository = mock(TicketProjectionRepository.class);
    private final MachineOnTicketsProjection projection = new MachineOnTicketsProjection(ticketProjectionRepository,
            machineRepository);

    @Test
    void anEvent_setsTheHostnameOnTheTicketsOfTheDeviceInItsTenant() {
        // execution
        projection.apply(buildRecord("tenant-a", "machine-1", "host-new", "Front desk"));

        // verifications
        verify(ticketProjectionRepository).updateDeviceHostname("tenant-a", "machine-1", "host-new");
    }

    @Test
    void theChanges_areCounted_andWrittenInBatches() {
        // setup
        PublishedRecord<MachineEvent> record = buildRecord("tenant-a", "machine-1", "host-new", null);
        when(ticketProjectionRepository.countTicketsToUpdateDeviceHostname("tenant-a", "machine-1", "host-new", 5000))
                .thenReturn(5000L);
        when(ticketProjectionRepository.updateDeviceHostnameBatch("tenant-a", "machine-1", "host-new", "t5", 1000))
                .thenReturn("t9");

        // execution and verifications
        assertThat(projection.countChanges(record, 5000)).isEqualTo(5000L);
        assertThat(projection.applyBatch(record, "t5", 1000)).isEqualTo("t9");
    }

    @Test
    void anOldHostname_isAMismatch_inItsOwnTenant_butAGoneMachineKeepsItsCopy() {
        // setup
        when(machineRepository.findByTenantIdInAndMachineIdIn(Set.of("tenant-a", "tenant-b"), Set.of("machine-1", "machine-gone")))
                .thenReturn(List.of(buildMachine("tenant-a", "machine-1", "host-a"), buildMachine("tenant-b", "machine-1", "host-b")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                new TicketDeviceView("t1", "tenant-a", "machine-1", "host-a"),
                new TicketDeviceView("t2", "tenant-b", "machine-1", "host-a"),
                new TicketDeviceView("t3", "tenant-a", "machine-gone", "host-x")));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("t2");
        assertThat(result.getMismatches()).extracting(Mismatch::getSourceId).containsExactly("doc-tenant-b");
    }

    @Test
    void ticketsWithoutADevice_areSkipped_withoutAQuery() {
        // execution
        ReconciliationResult result = projection.reconcile(List.of(new TicketDeviceView("t1", "tenant-a", null, null)));

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
        MongoPersistentEntity<?> view = mappingContext.getRequiredPersistentEntity(TicketDeviceView.class);

        // execution and verifications
        assertThat(projection.name()).isEqualTo("machine-on-tickets");
        view.doWithProperties((PropertyHandler<MongoPersistentProperty>) viewProperty -> {
            String name = viewProperty.getName();
            MongoPersistentProperty ticketProperty = ticket.getPersistentProperty(name);
            assertThat(ticketProperty).as(name).isNotNull();
            assertThat(viewProperty.getFieldName()).isEqualTo(ticketProperty.getFieldName());
        });
    }

    private static Machine buildMachine(String tenantId, String machineId, String hostname) {
        Machine machine = new Machine();
        machine.setId("doc-" + tenantId);
        machine.setTenantId(tenantId);
        machine.setMachineId(machineId);
        machine.setHostname(hostname);
        return machine;
    }

    private static PublishedRecord<MachineEvent> buildRecord(String tenantId, String machineId, String hostname, String nickname) {
        MachineEvent event = MachineEvent.builder().machineId(machineId).hostname(hostname).nickname(nickname).build();
        return PublishedRecord.<MachineEvent>builder().tenantId(tenantId).version(4L).schemaVersion(1).event(event).build();
    }
}
