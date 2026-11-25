package com.openframe.api.service.ticket;

import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.audit.AuditedWork;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.repository.ticket.TicketNoteRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.data.document.audit.AuditAction.TICKET_NOTE_DELETE;
import static com.openframe.data.document.audit.AuditTargetType.TICKET;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketNoteServiceTest {

    private static final String NOTE_ID = "note-1";
    private static final String TICKET_ID = "ticket-1";
    private static final String AUTHOR_ID = "user-1";
    private static final String OLD_TEXT = "Call the customer back";
    private static final String NEW_TEXT = "Customer called, waiting for logs";

    @Mock private TicketNoteRepository noteRepository;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @InjectMocks private TicketNoteService service;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;

    @Test
    void updateNote_newContent_storesTheEvent() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        service.updateNote(admin(AUTHOR_ID), NOTE_ID, NEW_TEXT);

        assertThat(capturedCall().storeIf().test(note)).isTrue();
    }

    @Test
    void updateNote_sameContent_storesNoEvent() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        service.updateNote(admin(AUTHOR_ID), NOTE_ID, OLD_TEXT);

        assertThat(capturedCall().storeIf().test(note)).isFalse();
    }

    @Test
    void updateNote_callerNotAdmin_isRefusedInsideTheAuditedRun() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.updateNote(agent(), NOTE_ID, NEW_TEXT))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Operation requires ADMIN access");
        verify(auditedMethodRunner).run(any(AuditCall.class), any());
        verify(noteRepository, never()).save(note);
    }

    @Test
    void updateNote_callerNotTheAuthor_isRefusedInsideTheAuditedRun() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.updateNote(admin("user-2"), NOTE_ID, NEW_TEXT))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the author can update this note");
        verify(auditedMethodRunner).run(any(AuditCall.class), any());
        verify(noteRepository, never()).save(note);
    }

    @Test
    void deleteNote_callerNotAdmin_isRefusedInsideTheAuditedRun() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.deleteNote(agent(), NOTE_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Operation requires ADMIN access");
        verifyAuditedDelete();
        verify(noteRepository, never()).delete(note);
    }

    @Test
    void deleteNote_callerNotTheAuthor_isRefusedInsideTheAuditedRun() {
        TicketNote note = existingNote();
        runsTheAuditedWork();

        assertThatThrownBy(() -> service.deleteNote(admin("user-2"), NOTE_ID))
                .isInstanceOf(ForbiddenException.class)
                .hasMessage("Only the author can delete this note");
        verifyAuditedDelete();
        verify(noteRepository, never()).delete(note);
    }

    private TicketNote existingNote() {
        TicketNote note = note(OLD_TEXT);
        when(noteRepository.findById(NOTE_ID)).thenReturn(Optional.of(note));
        return note;
    }

    private static TicketNote note(String content) {
        return TicketNote.builder().id(NOTE_ID).ticketId(TICKET_ID).authorId(AUTHOR_ID).content(content).build();
    }

    private void runsTheAuditedWork() {
        when(auditedMethodRunner.run(any(AuditCall.class), any()))
                .thenAnswer(invocation -> invocation.<AuditedWork<?, ?>>getArgument(1).run());
    }

    private void verifyAuditedDelete() {
        assertThat(capturedCall())
                .extracting(AuditCall::action, AuditCall::targetType, call -> call.targetIdBeforeCall().get(),
                        call -> call.detailsFromResult().apply(null), AuditCall::compare)
                .containsExactly(TICKET_NOTE_DELETE, TICKET, TICKET_ID, Map.of("noteIds", List.of(NOTE_ID)), false);
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static AuthPrincipal admin(String id) {
        return AuthPrincipal.builder().id(id).actorType(ActorType.ADMIN).build();
    }

    private static AuthPrincipal agent() {
        return AuthPrincipal.builder().id("machine-1").actorType(ActorType.AGENT).build();
    }
}
