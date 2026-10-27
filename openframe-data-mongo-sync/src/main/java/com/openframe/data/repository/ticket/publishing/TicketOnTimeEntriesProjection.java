package com.openframe.data.repository.ticket.publishing;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.ticket.TicketProjectionRepository;
import com.openframe.data.repository.timetracking.TimeEntryProjectionRepository;
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

// The ticket title every time entry keeps (ticketTitle, by ticketId); TimeEntryCascadeAspect writes it until the mode is events.
@Slf4j
@Component
@RequiredArgsConstructor
public class TicketOnTimeEntriesProjection implements Projection<TicketEvent, TimeEntryTicketView> {

    private static final String NAME = "ticket-on-time-entries";

    private final TimeEntryProjectionRepository timeEntryProjectionRepository;
    private final TicketProjectionRepository ticketProjectionRepository;

    @Override
    public String name() {
        return NAME;
    }

    @Override
    public void apply(PublishedRecord<TicketEvent> record) {
        String tenantId = record.getTenantId();
        TicketEvent event = record.getEvent();
        String ticketId = event.getTicketId();
        String title = event.getTitle();
        long updated = timeEntryProjectionRepository.updateTicketTitle(tenantId, ticketId, title);
        log.debug("{} set the title of ticket {} on {} time entries of tenant {}", NAME, ticketId, updated, tenantId);
    }

    @Override
    public long countChanges(PublishedRecord<TicketEvent> record, int limit) {
        String tenantId = record.getTenantId();
        TicketEvent event = record.getEvent();
        String ticketId = event.getTicketId();
        String title = event.getTitle();
        return timeEntryProjectionRepository.countTimeEntriesToUpdateTicketTitle(tenantId, ticketId, title, limit);
    }

    @Override
    public String applyBatch(PublishedRecord<TicketEvent> record, String lastId, int batchSize) {
        String tenantId = record.getTenantId();
        TicketEvent event = record.getEvent();
        String ticketId = event.getTicketId();
        String title = event.getTitle();
        return timeEntryProjectionRepository.updateTicketTitleBatch(tenantId, ticketId, title, lastId, batchSize);
    }

    @Override
    public Class<TimeEntry> projectedClass() {
        return TimeEntry.class;
    }

    @Override
    public Class<TimeEntryTicketView> projectedViewClass() {
        return TimeEntryTicketView.class;
    }

    @Override
    public ReconciliationResult reconcile(List<TimeEntryTicketView> projectedItems) {
        List<TimeEntryTicketView> withTicket = projectedItems.stream()
            .filter(timeEntry -> timeEntry.getTicketId() != null)
            .toList();

        if (withTicket.isEmpty()) {
            return ReconciliationResult.allMatch();
        }

        Set<String> tenantIds = withTicket.stream().map(TimeEntryTicketView::getTenantId).collect(toSet());
        Set<String> ticketIds = withTicket.stream().map(TimeEntryTicketView::getTicketId).collect(toSet());
        Map<TenantScopedId, String> titles = findTitles(tenantIds, ticketIds);

        List<Mismatch> mismatches = withTicket.stream()
            .map(timeEntry -> toMismatch(timeEntry, titles))
            .filter(Objects::nonNull)
            .toList();
        return new ReconciliationResult(mismatches);
    }

    // The current title of every ticket of the batch, in one query.
    private Map<TenantScopedId, String> findTitles(Set<String> tenantIds, Set<String> ticketIds) {
        Map<TenantScopedId, String> titles = new HashMap<>();
        for (Ticket ticket : ticketProjectionRepository.findTitles(tenantIds, ticketIds)) {
            String tenantId = ticket.getTenantId();
            String ticketId = ticket.getId();
            TenantScopedId key = new TenantScopedId(tenantId, ticketId);
            String title = ticket.getTitle();
            titles.put(key, title);
        }
        return titles;
    }

    // Null when the copy matches its ticket.
    private static Mismatch toMismatch(TimeEntryTicketView timeEntry, Map<TenantScopedId, String> titles) {
        String tenantId = timeEntry.getTenantId();
        String timeEntryId = timeEntry.getId();
        String ticketId = timeEntry.getTicketId();
        TenantScopedId key = new TenantScopedId(tenantId, ticketId);
        // The copy is kept when its source is deleted, so a source that is gone leaves no mismatch.
        if (!titles.containsKey(key)) {
            return null;
        }
        String sourceTitle = titles.get(key);
        String copiedTitle = timeEntry.getTicketTitle();
        if (Objects.equals(sourceTitle, copiedTitle)) {
            return null;
        }
        return new Mismatch(tenantId, timeEntryId, ticketId,
            "title \"" + copiedTitle + "\" differs from ticket's \"" + sourceTitle + "\"");
    }
}
