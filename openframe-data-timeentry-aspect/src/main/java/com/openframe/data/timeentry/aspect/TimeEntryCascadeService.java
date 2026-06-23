package com.openframe.data.timeentry.aspect;

import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.List;
import java.util.Objects;

@Slf4j
@RequiredArgsConstructor
public class TimeEntryCascadeService {

    private final TimeEntryRepository timeEntryRepository;

    public void updateTimeEntriesForTicketTitleChange(String ticketId, String newTitle) {
        List<TimeEntry> entries = timeEntryRepository.findByTicketId(ticketId);

        if (entries.isEmpty()) {
            log.debug("No time entries found for ticketId: {}", ticketId);
            return;
        }

        List<TimeEntry> toUpdate = entries.stream()
                .filter(e -> !Objects.equals(newTitle, e.getTicketTitle()))
                .toList();

        if (!toUpdate.isEmpty()) {
            toUpdate.forEach(e -> e.setTicketTitle(newTitle));
            timeEntryRepository.saveAll(toUpdate);
            log.info("Cascade updated ticketTitle for {} time entries (ticketId: {}, newTitle: {})",
                    toUpdate.size(), ticketId, newTitle);
        }
    }
}
