package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusHistory;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketStatusHistoryRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;

/**
 * The recorder wires the mapped row to the repository — row content is the mapper's contract,
 * covered in {@link TicketStatusHistoryMapperTest}. What matters here: the row that reaches the
 * repository is the mapper's output, and a failed write never breaks the transition.
 */
@ExtendWith(MockitoExtension.class)
class TicketStatusHistoryServiceTest {

    private static final String TICKET_ID = "ticket-1";

    @Mock private TicketStatusHistoryRepository historyRepository;

    @Captor private ArgumentCaptor<TicketStatusHistory> recordCaptor;

    private TicketStatusHistoryService historyService;

    @BeforeEach
    void setUp() {
        historyService = new TicketStatusHistoryService(historyRepository, new TicketStatusHistoryMapper());
    }

    @Test
    void record_savesTheMappedRow() {
        // execution
        historyService.record(ticket(), resolvedStatus(), techStatus(), adminPrincipal(), "problem is back");

        // verifications
        verify(historyRepository).save(recordCaptor.capture());
        TicketStatusHistory row = recordCaptor.getValue();
        assertThat(row.getTicketId()).isEqualTo(TICKET_ID);
        assertThat(row.getToStatusKind()).isEqualTo("TECH_REQUIRED");
        assertThat(row.getReason()).isEqualTo("problem is back");
    }

    @Test
    void record_repositoryThrows_transitionUnaffected() {
        // setup
        doThrow(new IllegalStateException("mongo down")).when(historyRepository).save(any());

        // execution + verifications
        assertThatCode(() -> historyService.record(ticket(), resolvedStatus(), techStatus(), adminPrincipal(), null))
                .doesNotThrowAnyException();
    }

    private Ticket ticket() {
        return Ticket.builder().id(TICKET_ID).build();
    }

    private TicketStatusDefinition resolvedStatus() {
        return TicketStatusDefinition.builder().id("st-resolved").kind(TicketStatusKind.RESOLVED).name("Resolved").build();
    }

    private TicketStatusDefinition techStatus() {
        return TicketStatusDefinition.builder().id("st-tech").kind(TicketStatusKind.TECH_REQUIRED).name("Tech Required").build();
    }

    private AuthPrincipal adminPrincipal() {
        return AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();
    }
}
