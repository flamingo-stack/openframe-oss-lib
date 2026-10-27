package com.openframe.data.repository.ticket.publishing;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.repository.timetracking.TimeEntryProjectionRepository;
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

class TicketOnTimeEntriesProjectionTest {

    private final TimeEntryProjectionRepository timeEntryProjectionRepository = mock(TimeEntryProjectionRepository.class);
    private final TicketProjectionRepository ticketProjectionRepository = mock(TicketProjectionRepository.class);
    private final TicketOnTimeEntriesProjection projection = new TicketOnTimeEntriesProjection(timeEntryProjectionRepository,
            ticketProjectionRepository);

    @Test
    void anEvent_setsTheTitleOnTheTimeEntriesOfTheTicketInItsTenant() {
        // execution
        projection.apply(buildRecord("tenant-a", "ticket-1", "Printer jam"));

        // verifications
        verify(timeEntryProjectionRepository).updateTicketTitle("tenant-a", "ticket-1", "Printer jam");
    }

    @Test
    void theChanges_areCounted_andWrittenInBatches() {
        // setup
        PublishedRecord<TicketEvent> record = buildRecord("tenant-a", "ticket-1", "Printer jam");
        when(timeEntryProjectionRepository.countTimeEntriesToUpdateTicketTitle("tenant-a", "ticket-1", "Printer jam", 5000))
                .thenReturn(5000L);
        when(timeEntryProjectionRepository.updateTicketTitleBatch("tenant-a", "ticket-1", "Printer jam", "e5", 1000))
                .thenReturn("e9");

        // execution and verifications
        assertThat(projection.countChanges(record, 5000)).isEqualTo(5000L);
        assertThat(projection.applyBatch(record, "e5", 1000)).isEqualTo("e9");
    }

    @Test
    void anOldTitle_isAMismatch_inItsOwnTenant_butAGoneTicketKeepsItsCopy() {
        // setup
        when(ticketProjectionRepository.findTitles(Set.of("tenant-a", "tenant-b"), Set.of("ticket-1", "ticket-gone")))
                .thenReturn(List.of(buildTicket("tenant-a", "ticket-1", "Printer jam"), buildTicket("tenant-b", "ticket-1", "Other")));

        // execution
        ReconciliationResult result = projection.reconcile(List.of(
                new TimeEntryTicketView("e1", "tenant-a", "ticket-1", "Printer jam"),
                new TimeEntryTicketView("e2", "tenant-b", "ticket-1", "Printer jam"),
                new TimeEntryTicketView("e3", "tenant-a", "ticket-gone", "Gone")));

        // verifications
        assertThat(result.getMismatches()).extracting(Mismatch::getProjectedItemId).containsExactly("e2");
        assertThat(result.getMismatches()).extracting(Mismatch::getSourceId).containsExactly("ticket-1");
    }

    @Test
    void timeEntriesWithoutATicket_areSkipped_withoutAQuery() {
        // execution
        ReconciliationResult result = projection.reconcile(List.of(new TimeEntryTicketView("e1", "tenant-a", null, null)));

        // verifications
        assertThat(result.getMismatches()).isEmpty();
        verify(ticketProjectionRepository, never()).findTitles(any(), any());
    }

    @Test
    void everyViewField_isATimeEntryProperty_storedUnderTheSameName() {
        // setup
        MongoMappingContext mappingContext = new MongoMappingContext();
        MongoCustomConversions conversions = new MongoCustomConversions(List.of());
        mappingContext.setSimpleTypeHolder(conversions.getSimpleTypeHolder());
        MongoPersistentEntity<?> timeEntry = mappingContext.getRequiredPersistentEntity(TimeEntry.class);
        MongoPersistentEntity<?> view = mappingContext.getRequiredPersistentEntity(TimeEntryTicketView.class);

        // execution and verifications
        assertThat(projection.name()).isEqualTo("ticket-on-time-entries");
        view.doWithProperties((PropertyHandler<MongoPersistentProperty>) viewProperty -> {
            String name = viewProperty.getName();
            MongoPersistentProperty timeEntryProperty = timeEntry.getPersistentProperty(name);
            assertThat(timeEntryProperty).as(name).isNotNull();
            assertThat(viewProperty.getFieldName()).isEqualTo(timeEntryProperty.getFieldName());
        });
    }

    private static Ticket buildTicket(String tenantId, String id, String title) {
        Ticket ticket = new Ticket();
        ticket.setTenantId(tenantId);
        ticket.setId(id);
        ticket.setTitle(title);
        return ticket;
    }

    private static PublishedRecord<TicketEvent> buildRecord(String tenantId, String ticketId, String title) {
        TicketEvent event = TicketEvent.builder().ticketId(ticketId).title(title).build();
        return PublishedRecord.<TicketEvent>builder().tenantId(tenantId).version(4L).schemaVersion(1).event(event).build();
    }
}
