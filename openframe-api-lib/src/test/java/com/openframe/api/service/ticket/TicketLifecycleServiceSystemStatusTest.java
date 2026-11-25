package com.openframe.api.service.ticket;

import com.openframe.api.service.ticket.spi.TicketEventListener;
import com.openframe.core.exception.InternalException;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.ticket.TicketStatusDefinitionRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketLifecycleServiceSystemStatusTest {

    private static final String CUSTOM_ID = "st-custom";
    private static final String TECH_REQUIRED_ID = "st-tech";
    private static final String OTHER_SYSTEM_ID = "st-system";
    private static final String UNKNOWN_ID = "st-unknown";

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketStatusDefinitionRepository statusRepository;
    @Mock private TicketTransitionPolicyValidator transitionPolicy;
    @Mock private TenantIdProvider tenantIdProvider;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private TicketResolverStamp ticketResolverStamp;
    @Mock private TicketStatusHistoryService historyService;
    @Mock private TicketEventListener listener;

    private TicketLifecycleService service;

    private Ticket ticket;
    private TicketStatusDefinition techRequired;

    @BeforeEach
    void setUp() {
        service = new TicketLifecycleService(ticketRepository, statusRepository, transitionPolicy,
                tenantIdProvider, ticketTagService, ticketIdsForFilter, ticketResolverStamp,
                historyService, List.of(listener));
        ticket = new Ticket();
        techRequired = definition(TECH_REQUIRED_ID, TicketStatusKind.TECH_REQUIRED);
    }

    @Test
    void applySystemInitialStatus_customStatusExists_thatStatus() {
        // setup
        when(statusRepository.findById(CUSTOM_ID))
                .thenReturn(Optional.of(definition(CUSTOM_ID, TicketStatusKind.CUSTOM)));

        // execution
        service.applySystemInitialStatus(ticket, CUSTOM_ID);

        // verifications
        assertThat(ticket)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind)
                .containsExactly(CUSTOM_ID, TicketStatusKind.CUSTOM);
    }

    @Test
    void applySystemInitialStatus_techRequiredId_thatStatus() {
        // setup
        when(statusRepository.findById(TECH_REQUIRED_ID)).thenReturn(Optional.of(techRequired));

        // execution
        service.applySystemInitialStatus(ticket, TECH_REQUIRED_ID);

        // verifications
        assertThat(ticket)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind)
                .containsExactly(TECH_REQUIRED_ID, TicketStatusKind.TECH_REQUIRED);
    }

    @ParameterizedTest
    @EnumSource(value = TicketStatusKind.class, names = {"AI_ASSISTANCE", "RESOLVED", "ARCHIVED"})
    void applySystemInitialStatus_kindNotCreatable_techRequired(TicketStatusKind kind) {
        // setup
        when(statusRepository.findById(OTHER_SYSTEM_ID)).thenReturn(Optional.of(definition(OTHER_SYSTEM_ID, kind)));
        when(statusRepository.findByKind(TicketStatusKind.TECH_REQUIRED)).thenReturn(Optional.of(techRequired));

        // execution
        service.applySystemInitialStatus(ticket, OTHER_SYSTEM_ID);

        // verifications
        assertThat(ticket)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind)
                .containsExactly(TECH_REQUIRED_ID, TicketStatusKind.TECH_REQUIRED);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(strings = {"", " ", UNKNOWN_ID})
    void applySystemInitialStatus_idMissing_techRequired(String statusId) {
        // setup
        when(statusRepository.findByKind(TicketStatusKind.TECH_REQUIRED)).thenReturn(Optional.of(techRequired));

        // execution
        service.applySystemInitialStatus(ticket, statusId);

        // verifications
        assertThat(ticket)
                .extracting(Ticket::getStatusId, Ticket::getStatusKind)
                .containsExactly(TECH_REQUIRED_ID, TicketStatusKind.TECH_REQUIRED);
    }

    @Test
    void applySystemInitialStatus_techRequiredNotSeeded_throwsInternalWithMessage() {
        // setup
        Ticket target = ticket;

        // execution
        InternalException ex = assertThrows(InternalException.class,
                () -> service.applySystemInitialStatus(target, UNKNOWN_ID));

        // verifications
        assertThat(ex.getMessage()).isEqualTo("System ticket status TECH_REQUIRED is not seeded for this tenant");
    }

    private static TicketStatusDefinition definition(String id, TicketStatusKind kind) {
        return TicketStatusDefinition.builder().id(id).kind(kind).name(kind.name()).build();
    }
}
