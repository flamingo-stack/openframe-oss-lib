package com.openframe.api.service.ticket;

import com.openframe.api.exception.ticket.InvalidTicketTransitionException;
import com.openframe.api.exception.ticket.TicketStatusLockedByApprovalException;
import com.openframe.api.service.ticket.spi.TicketClientConversationGate;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketResolver;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.repository.ticket.TicketStatusHistoryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Reopen-to-assistant is the guarded edge: it needs a client conversation to come back to and a
 * history that never visited a human stage — once people owned a ticket, reopening returns it to
 * people. Everything else follows the kind matrix.
 */
@ExtendWith(MockitoExtension.class)
class TicketTransitionPolicyValidatorTest {

    private static final String TICKET_ID = "ticket-1";
    private static final String APPROVAL_ID = "approval-1";

    @Mock private TicketStatusDefinitionRepository statusRepository;
    @Mock private TicketStatusHistoryRepository historyRepository;
    @Mock private TicketClientConversationGate conversationGate;
    @Mock private ObjectProvider<TicketClientConversationGate> gateProvider;

    private TicketTransitionPolicyValidator validator;

    private final TicketStatusDefinition resolved = definition("st-resolved", TicketStatusKind.RESOLVED, "Resolved");
    private final TicketStatusDefinition archived = definition("st-archived", TicketStatusKind.ARCHIVED, "Archived");
    private final TicketStatusDefinition techRequired = definition("st-tech", TicketStatusKind.TECH_REQUIRED, "Tech Required");
    private final TicketStatusDefinition inProgress = definition("st-custom", TicketStatusKind.CUSTOM, "In Progress");
    private final TicketStatusDefinition aiAssistance = definition("st-ai", TicketStatusKind.AI_ASSISTANCE, "AI Handling");

    @BeforeEach
    void setUp() {
        validator = new TicketTransitionPolicyValidator(statusRepository, historyRepository, gateProvider);
        lenient().when(gateProvider.getIfAvailable()).thenReturn(conversationGate);
    }

    @Test
    void allowedNext_resolvedTicket_excludesAiAssistance() {
        // setup
        // AI Handling is filtered out before the reopen gate is ever consulted
        when(statusRepository.findAllByOrderByPositionAsc())
                .thenReturn(List.of(aiAssistance, inProgress, techRequired, resolved, archived));

        // execution
        List<TicketStatusDefinition> next = validator.allowedNext(closedTicket(resolved));

        // verifications — AI Handling stays off the menu
        assertThat(next).containsExactly(inProgress, techRequired, archived);
    }

    @Test
    void allowedNextFor_resolvedStatus_excludesAiAssistance() {
        // setup
        List<TicketStatusDefinition> statuses =
                List.of(aiAssistance, inProgress, techRequired, resolved, archived);

        // execution
        List<TicketStatusDefinition> next = validator.allowedNextFor(resolved, statuses);

        // verifications
        assertThat(next).containsExactly(inProgress, techRequired, archived);
    }

    @Test
    void validateAndResolve_resolvedToCustom_allowed() {
        // setup
        when(statusRepository.findById(inProgress.getId())).thenReturn(Optional.of(inProgress));

        // execution + verifications
        assertThatCode(() -> validator.validateAndResolve(closedTicket(resolved), inProgress.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void validateAndResolve_faeTicketThatNeverLeftAi_allowed() {
        // setup — resolved straight from the assistant, never touched a human stage
        when(statusRepository.findById(aiAssistance.getId())).thenReturn(Optional.of(aiAssistance));
        when(conversationGate.hasClientConversation(TICKET_ID)).thenReturn(true);
        when(historyRepository.findByTicketIdOrderByCreatedAtAsc(TICKET_ID))
                .thenReturn(List.of(transition("AI_ASSISTANCE", "RESOLVED")));

        // execution + verifications
        assertThatCode(() -> validator.validateAndResolve(closedTicket(resolved), aiAssistance.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void validateAndResolve_ticketThatVisitedTechnicians_rejected() {
        // setup — the history shows an escalation; once people owned it, it returns to people
        when(statusRepository.findById(aiAssistance.getId())).thenReturn(Optional.of(aiAssistance));
        when(conversationGate.hasClientConversation(TICKET_ID)).thenReturn(true);
        when(historyRepository.findByTicketIdOrderByCreatedAtAsc(TICKET_ID))
                .thenReturn(List.of(transition("AI_ASSISTANCE", "TECH_REQUIRED"),
                        transition("TECH_REQUIRED", "RESOLVED")));
        when(statusRepository.findAllByOrderByPositionAsc())
                .thenReturn(List.of(aiAssistance, techRequired, resolved, archived));

        // execution + verifications
        assertThatThrownBy(() -> validator.validateAndResolve(closedTicket(resolved), aiAssistance.getId()))
                .isInstanceOf(InvalidTicketTransitionException.class);
    }

    @Test
    void validateAndResolve_preHistoryTicket_fallsBackToResolver() {
        // setup — closed before the history existed: only an assistant closure is trusted
        when(statusRepository.findById(aiAssistance.getId())).thenReturn(Optional.of(aiAssistance));
        when(conversationGate.hasClientConversation(TICKET_ID)).thenReturn(true);
        when(historyRepository.findByTicketIdOrderByCreatedAtAsc(TICKET_ID)).thenReturn(List.of());
        Ticket ticket = closedTicket(resolved);
        ticket.setResolvedBy(TicketResolver.END_USER);

        // execution + verifications
        assertThatCode(() -> validator.validateAndResolve(ticket, aiAssistance.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void validateAndResolve_noConversationGateDeployed_reopenToAiRejected() {
        // setup — a deployment without the conversational layer never reopens into the assistant
        when(statusRepository.findById(aiAssistance.getId())).thenReturn(Optional.of(aiAssistance));
        when(gateProvider.getIfAvailable()).thenReturn(null);
        when(statusRepository.findAllByOrderByPositionAsc())
                .thenReturn(List.of(aiAssistance, techRequired, resolved, archived));

        // execution + verifications
        assertThatThrownBy(() -> validator.validateAndResolve(closedTicket(resolved), aiAssistance.getId()))
                .isInstanceOf(InvalidTicketTransitionException.class);
    }

    @Test
    void validateAndResolve_techRequiredWithPendingApproval_rejectedNamingTheRequest() {
        // setup
        when(statusRepository.findById(inProgress.getId())).thenReturn(Optional.of(inProgress));
        when(conversationGate.findPendingApprovalRequestId(TICKET_ID)).thenReturn(Optional.of(APPROVAL_ID));
        Ticket ticket = closedTicket(techRequired);

        // execution
        TicketStatusLockedByApprovalException ex = assertThrows(TicketStatusLockedByApprovalException.class,
                () -> validator.validateAndResolve(ticket, inProgress.getId()));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("Ticket status is locked while approval request approval-1 "
                + "is pending. Approve or reject it before changing the status.");
        assertThat(ex.getExtensions())
                .containsEntry("ticketId", TICKET_ID)
                .containsEntry("approvalRequestId", APPROVAL_ID);
    }

    @Test
    void validateAndResolve_techRequiredWithPendingApproval_sameStatusStillPasses() {
        // setup
        when(statusRepository.findById(techRequired.getId())).thenReturn(Optional.of(techRequired));
        Ticket ticket = closedTicket(techRequired);

        // execution
        TicketStatusDefinition target = validator.validateAndResolve(ticket, techRequired.getId());

        // verifications
        assertThat(target).isEqualTo(techRequired);
        verifyNoInteractions(conversationGate);
    }

    @Test
    void validateAndResolve_techRequiredWithoutPendingApproval_allowed() {
        // setup
        when(statusRepository.findById(resolved.getId())).thenReturn(Optional.of(resolved));
        when(conversationGate.findPendingApprovalRequestId(TICKET_ID)).thenReturn(Optional.empty());
        Ticket ticket = closedTicket(techRequired);

        // execution + verifications
        assertThatCode(() -> validator.validateAndResolve(ticket, resolved.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void validateAndResolve_customStatusTicket_pendingApprovalNotConsulted() {
        // setup
        when(statusRepository.findById(resolved.getId())).thenReturn(Optional.of(resolved));
        Ticket ticket = closedTicket(inProgress);

        // execution
        validator.validateAndResolve(ticket, resolved.getId());

        // verifications
        verify(conversationGate, never()).findPendingApprovalRequestId(TICKET_ID);
    }

    @Test
    void validateAndResolve_noGateDeployed_techRequiredMovesFreely() {
        // setup
        when(statusRepository.findById(resolved.getId())).thenReturn(Optional.of(resolved));
        when(gateProvider.getIfAvailable()).thenReturn(null);
        Ticket ticket = closedTicket(techRequired);

        // execution + verifications
        assertThatCode(() -> validator.validateAndResolve(ticket, resolved.getId()))
                .doesNotThrowAnyException();
    }

    @Test
    void allowedNext_techRequiredWithPendingApproval_nothingOffered() {
        // setup
        when(conversationGate.findPendingApprovalRequestId(TICKET_ID)).thenReturn(Optional.of(APPROVAL_ID));

        // execution
        List<TicketStatusDefinition> next = validator.allowedNext(closedTicket(techRequired));

        // verifications
        assertThat(next).isEmpty();
        verifyNoInteractions(statusRepository);
    }

    private Ticket closedTicket(TicketStatusDefinition status) {
        return Ticket.builder()
                .id(TICKET_ID)
                .statusId(status.getId())
                .statusKind(status.getKind())
                .build();
    }

    private TicketStatusHistory transition(String fromKind, String toKind) {
        return TicketStatusHistory.builder()
                .ticketId(TICKET_ID).fromStatusKind(fromKind).toStatusKind(toKind).build();
    }

    private static TicketStatusDefinition definition(String id, TicketStatusKind kind, String name) {
        return TicketStatusDefinition.builder().id(id).kind(kind).name(name).build();
    }
}
