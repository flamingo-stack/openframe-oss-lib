package com.openframe.api.service;

import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand;
import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand.UpdateTimeEntryCommandBuilder;
import com.openframe.core.exception.ValidationException;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.data.repository.timetracking.TimeEntryRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimeEntryServiceEditTest {

    private static final String ENTRY_ID = "entry-1";
    private static final String OWNER_ID = "user-1";
    private static final String EDITOR_ID = "admin-1";
    private static final String TICKET_ID = "ticket-1";

    @Mock private TimeEntryRepository timeEntryRepository;
    @Mock private TicketQueryService ticketQueryService;

    @InjectMocks private TimeEntryService service;

    @Test
    void updateTimeEntry_sameStartAndDuration_keepsTheEndTime() {
        givenEditable();

        TimeEntry saved = service.updateTimeEntry(EDITOR_ID, edit()
                .startedAt(Instant.parse("2026-11-20T09:00:00Z"))
                .durationSeconds(3000L)
                .build());

        assertThat(saved.getEndedAt()).isEqualTo(Instant.parse("2026-11-20T10:00:00Z"));
    }

    @Test
    void updateTimeEntry_newStart_endsTheStoredDurationLater() {
        givenEditable();

        TimeEntry saved = service.updateTimeEntry(EDITOR_ID, edit()
                .startedAt(Instant.parse("2026-11-20T10:00:00Z"))
                .build());

        assertThat(saved).extracting(TimeEntry::getStartedAt, TimeEntry::getEndedAt)
                .containsExactly(Instant.parse("2026-11-20T10:00:00Z"), Instant.parse("2026-11-20T10:50:00Z"));
    }

    @Test
    void updateTimeEntry_newDuration_endsThatLongAfterTheStoredStart() {
        givenEditable();

        TimeEntry saved = service.updateTimeEntry(EDITOR_ID, edit().durationSeconds(1800L).build());

        assertThat(saved).extracting(TimeEntry::getStartedAt, TimeEntry::getDurationSeconds, TimeEntry::getEndedAt)
                .containsExactly(Instant.parse("2026-11-20T09:00:00Z"), 1800L, Instant.parse("2026-11-20T09:30:00Z"));
    }

    @Test
    void updateTimeEntry_zeroDuration_isRefused() {
        givenStored(completedEntry());

        assertThatThrownBy(() -> service.updateTimeEntry(EDITOR_ID, edit().durationSeconds(0L).build()))
                .isInstanceOf(ValidationException.class)
                .hasMessage("Duration must be positive");
    }

    @Test
    void unlinkTicketFromTimeEntry_linkedEntry_clearsTheTicketIdNumberAndTitle() {
        givenEditable();

        TimeEntry saved = service.unlinkTicketFromTimeEntry(EDITOR_ID, ENTRY_ID);

        assertThat(saved).extracting(TimeEntry::getTicketId, TimeEntry::getTicketNumber, TimeEntry::getTicketTitle,
                        TimeEntry::getLastModifiedBy)
                .containsExactly(null, null, null, EDITOR_ID);
    }

    private void givenStored(TimeEntry entry) {
        when(timeEntryRepository.findById(ENTRY_ID)).thenReturn(Optional.of(entry));
    }

    private void givenEditable() {
        TimeEntry entry = completedEntry();
        givenStored(entry);
        when(timeEntryRepository.save(entry)).thenReturn(entry);
    }

    private static UpdateTimeEntryCommandBuilder edit() {
        return UpdateTimeEntryCommand.builder().id(ENTRY_ID);
    }

    private static TimeEntry completedEntry() {
        return TimeEntry.builder()
                .id(ENTRY_ID)
                .userId(OWNER_ID)
                .ticketId(TICKET_ID)
                .ticketNumber(42)
                .ticketTitle("Printer is on fire")
                .organizationId("org-1")
                .notes("Replaced the toner")
                .startedAt(Instant.parse("2026-11-20T09:00:00Z"))
                .endedAt(Instant.parse("2026-11-20T10:00:00Z"))
                .durationSeconds(3000)
                .breakSeconds(600)
                .lastModifiedBy(OWNER_ID)
                .build();
    }
}
