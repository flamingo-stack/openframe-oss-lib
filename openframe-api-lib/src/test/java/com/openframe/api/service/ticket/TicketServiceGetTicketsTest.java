package com.openframe.api.service.ticket;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.service.AssignmentService;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.filter.TicketQueryFilter;
import com.openframe.data.repository.device.MachineRepository;
import com.openframe.data.repository.organization.OrganizationRepository;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.data.repository.user.UserRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.stream.IntStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketServiceGetTicketsTest {

    private static final AuthPrincipal ADMIN = AuthPrincipal.builder().id("admin-1").actorType(ActorType.ADMIN).build();

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketNumberService ticketNumberService;
    @Mock private TicketTagService ticketTagService;
    @Mock private TicketIdsForFilter ticketIdsForFilter;
    @Mock private MachineRepository machineRepository;
    @Mock private OrganizationRepository organizationRepository;
    @Mock private UserRepository userRepository;
    @Mock private AssignmentService assignmentService;
    @Mock private TicketOrderCalculationService ticketOrderCalculationService;
    @Mock private TicketLifecycleService ticketLifecycleService;
    @Mock private TicketResolverStamp ticketResolverStamp;

    private final Query query = new Query();

    private TicketService ticketService;

    @BeforeEach
    void setUp() {
        ticketService = new TicketService(ticketRepository, ticketNumberService, ticketTagService, ticketIdsForFilter,
                machineRepository, organizationRepository, userRepository, assignmentService,
                ticketOrderCalculationService, ticketLifecycleService, ticketResolverStamp, List.of());
    }

    @ParameterizedTest
    @CsvSource({
            "3, 2, 2, true",
            "2, 2, 2, false",
            "1, 2, 1, false",
            "0, 2, 0, false"
    })
    void getTickets_rowsReturnedAgainstLimit_pageTrimmedAndNextPageFlagged(
            int returned, int limit, int expectedItems, boolean expectedHasNextPage) {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), eq(limit + 1), isNull(), eq("DESC")))
                .thenReturn(tickets(returned));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(limit, null), null, null);

        assertThat(result.getItems()).hasSize(expectedItems);
        assertThat(result.getPageInfo().isHasNextPage()).isEqualTo(expectedHasNextPage);
    }

    @Test
    void getTickets_moreRowsThanLimit_endCursorIsLastShownRowNotProbeRow() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(3));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, null), null, null);

        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1", "id-2");
        assertThat(result.getPageInfo())
                .returns("id-1", PageInfo::getStartCursor)
                .returns("id-2", PageInfo::getEndCursor);
    }

    @Test
    void getTickets_noRows_noCursorsAndNoNextPage() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), eq(3), isNull(), eq("DESC")))
                .thenReturn(List.of());

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, null), null, null);

        assertThat(result.getItems()).isEmpty();
        assertThat(result.getPageInfo())
                .returns(false, PageInfo::isHasNextPage)
                .returns(null, PageInfo::getStartCursor)
                .returns(null, PageInfo::getEndCursor);
    }

    @Test
    void getTickets_nullPagination_fetchesDefaultPageSizePlusOne() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), eq(21), isNull(), eq("DESC")))
                .thenReturn(tickets(21));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, null, null, null);

        assertThat(result.getItems()).hasSize(20);
        assertThat(result.getPageInfo().isHasNextPage()).isTrue();
    }

    @Test
    void getTickets_cursorGiven_hasPreviousPage() {
        stubQuery(null);
        when(ticketRepository.findTicketsWithCursor(eq(query), eq("id-0"), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(1));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(ADMIN, null, page(2, "id-0"), null, null);

        assertThat(result.getPageInfo().isHasPreviousPage()).isTrue();
    }

    @Test
    void getTickets_agentPrincipal_queryScopedToOwnMachine() {
        AuthPrincipal agent = AuthPrincipal.builder().machineId("machine-1").actorType(ActorType.AGENT).build();
        stubQuery("machine-1");
        when(ticketRepository.findTicketsWithCursor(eq(query), isNull(), eq(3), isNull(), eq("DESC")))
                .thenReturn(tickets(1));

        CountedGenericQueryResult<Ticket> result = ticketService.getTickets(agent, null, page(2, null), null, null);

        assertThat(result.getItems()).extracting(Ticket::getId).containsExactly("id-1");
    }

    private void stubQuery(String ownerMachineId) {
        when(ticketRepository.buildTicketQuery(any(TicketQueryFilter.class), isNull(), eq(List.of()), eq(ownerMachineId)))
                .thenReturn(query);
    }

    private static CursorPaginationCriteria page(int limit, String cursor) {
        return CursorPaginationCriteria.builder().limit(limit).cursor(cursor).build();
    }

    private static List<Ticket> tickets(int count) {
        return IntStream.rangeClosed(1, count).mapToObj(i -> Ticket.builder().id("id-" + i).build()).toList();
    }
}
