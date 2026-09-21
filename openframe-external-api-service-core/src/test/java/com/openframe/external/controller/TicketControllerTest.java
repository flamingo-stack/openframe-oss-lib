package com.openframe.external.controller;

import com.openframe.api.dto.CountedGenericQueryResult;
import com.openframe.api.dto.shared.CursorPaginationCriteria;
import com.openframe.api.dto.shared.PageInfo;
import com.openframe.api.dto.shared.SortDirection;
import com.openframe.api.dto.shared.SortInput;
import com.openframe.api.dto.ticket.CreateTicketInput;
import com.openframe.api.dto.ticket.TicketFilterInput;
import com.openframe.api.dto.ticket.TicketFilterOption;
import com.openframe.api.dto.ticket.TicketFilters;
import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.api.dto.ticket.TicketStatusCount;
import com.openframe.api.dto.ticket.TicketStatusDefinitionCount;
import com.openframe.api.dto.ticket.TransitionTicketInput;
import com.openframe.api.dto.ticket.UpdateTicketInput;
import com.openframe.api.exception.ticket.InvalidTicketTransitionException;
import com.openframe.api.exception.ticket.TicketNotFoundException;
import com.openframe.api.exception.ticket.TicketStatusNotFoundException;
import com.openframe.external.exception.TicketNoteNotFoundException;
import com.openframe.api.service.ticket.TicketFilterService;
import com.openframe.api.service.ticket.TicketLifecycleService;
import com.openframe.api.service.ticket.TicketNoteService;
import com.openframe.api.service.ticket.TicketService;
import com.openframe.api.service.ticket.TicketStatisticsService;
import com.openframe.api.service.ticket.TicketStatusService;
import com.openframe.api.service.ticket.TicketTagService;
import com.openframe.core.exception.ForbiddenException;
import com.openframe.core.exception.UnauthorizedException;
import com.openframe.data.document.tag.Tag;
import com.openframe.data.document.ticket.Ticket;
import com.openframe.data.document.ticket.TicketNote;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.external.dto.ticket.TicketResponse;
import com.openframe.external.mapper.TicketMapper;
import com.openframe.external.security.ApiKeyPrincipalResolver;
import com.openframe.external.service.TicketReadService;
import com.openframe.external.support.ExternalApiMockMvc;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Instant;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;

import static com.openframe.external.support.ExternalApiMockMvc.USER_ID;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.same;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class TicketControllerTest {

    private static final String BASE = "/api/v1/tickets";
    private static final String TICKET_ID = "65f0c0ffee0123456789abcd";
    private static final Instant CREATED_AT = Instant.parse("2026-01-10T08:00:00.123456789Z");

    @Mock
    private TicketService ticketService;
    @Mock
    private TicketFilterService ticketFilterService;
    @Mock
    private TicketStatusService ticketStatusService;
    @Mock
    private TicketTagService ticketTagService;
    @Mock
    private TicketNoteService ticketNoteService;
    @Mock
    private TicketStatisticsService ticketStatisticsService;
    @Mock
    private TicketLifecycleService ticketLifecycleService;
    @Mock
    private TicketReadService ticketReadService;
    @Mock
    private ApiKeyPrincipalResolver principalResolver;

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        mockMvc = ExternalApiMockMvc.standalone(new TicketController(
                ticketService, ticketFilterService, ticketStatusService, ticketTagService, ticketNoteService,
                ticketStatisticsService, ticketLifecycleService, ticketReadService, new TicketMapper(),
                principalResolver));
    }

    @Test
    void listWithoutParamsUsesDefaultsAndReturnsThePage() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        List<Ticket> items = List.of(ticket());
        CountedGenericQueryResult<Ticket> result = CountedGenericQueryResult.<Ticket>builder()
                .items(items)
                .pageInfo(PageInfo.builder().hasNextPage(true).startCursor(TICKET_ID).endCursor(TICKET_ID).build())
                .filteredCount(37)
                .build();
        when(ticketService.getTickets(same(principal), any(), any(), any(), any())).thenReturn(result);
        when(ticketReadService.toResponses(same(principal), same(items))).thenReturn(List.of(ticketResponse()));

        mockMvc.perform(get(BASE))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tickets.length()").value(1))
                .andExpect(jsonPath("$.tickets[0].id").value(TICKET_ID))
                .andExpect(jsonPath("$.tickets[0].ticketNumber").value(42))
                .andExpect(jsonPath("$.tickets[0].customerId").value("org-1"))
                .andExpect(jsonPath("$.tickets[0].createdAt").value("2026-01-10T08:00:00.123Z"))
                .andExpect(jsonPath("$.pageInfo.hasNextPage").value(true))
                .andExpect(jsonPath("$.pageInfo.endCursor").value(TICKET_ID))
                .andExpect(jsonPath("$.filteredCount").value(37));

        ArgumentCaptor<TicketFilterInput> filter = ArgumentCaptor.forClass(TicketFilterInput.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        ArgumentCaptor<String> search = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(ticketService).getTickets(same(principal), filter.capture(), pagination.capture(), search.capture(), sort.capture());
        assertEquals(new TicketFilterInput(), filter.getValue());
        assertEquals(20, pagination.getValue().getLimit());
        assertNull(pagination.getValue().getCursor());
        assertFalse(pagination.getValue().isBackward());
        assertNull(search.getValue());
        assertNull(sort.getValue());
    }

    @Test
    void listPassesQueryParamsIntoFilterPaginationSearchAndSort() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        stubEmptyPage(principal);

        mockMvc.perform(get(BASE)
                        .param("statuses", "ACTIVE", "RESOLVED")
                        .param("statusIds", "st-1", "st-2")
                        .param("customerIds", "org-1", "org-2")
                        .param("assigneeIds", "user-2")
                        .param("tagIds", "tag-1,tag-2")
                        .param("search", "printer")
                        .param("limit", "50")
                        .param("cursor", TICKET_ID)
                        .param("sortField", "ticketNumber")
                        .param("sortDirection", "asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tickets.length()").value(0))
                .andExpect(jsonPath("$.filteredCount").value(0));

        ArgumentCaptor<TicketFilterInput> filter = ArgumentCaptor.forClass(TicketFilterInput.class);
        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(ticketService).getTickets(same(principal), filter.capture(), pagination.capture(), eq("printer"), sort.capture());
        assertEquals(List.of(TicketStatus.ACTIVE, TicketStatus.RESOLVED), filter.getValue().getStatuses());
        assertEquals(List.of("st-1", "st-2"), filter.getValue().getStatusIds());
        assertEquals(List.of("org-1", "org-2"), filter.getValue().getOrganizationIds());
        assertEquals(List.of("user-2"), filter.getValue().getAssigneeIds());
        assertEquals(List.of("tag-1", "tag-2"), filter.getValue().getTagIds());
        assertEquals(50, pagination.getValue().getLimit());
        assertEquals(TICKET_ID, pagination.getValue().getCursor());
        assertEquals(new SortInput("ticketNumber", SortDirection.ASC), sort.getValue());
    }

    @Test
    void listSortsByOrganizationNameWhenCustomerNameIsRequestedAndDefaultsToDescending() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        stubEmptyPage(principal);

        mockMvc.perform(get(BASE).param("sortField", "customerName"))
                .andExpect(status().isOk());

        ArgumentCaptor<SortInput> sort = ArgumentCaptor.forClass(SortInput.class);
        verify(ticketService).getTickets(same(principal), any(), any(), any(), sort.capture());
        assertEquals(new SortInput("organizationName", SortDirection.DESC), sort.getValue());
    }

    @Test
    void listTreatsBlankCursorAsFirstPage() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        stubEmptyPage(principal);

        mockMvc.perform(get(BASE).param("cursor", " "))
                .andExpect(status().isOk());

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(ticketService).getTickets(same(principal), any(), pagination.capture(), any(), any());
        assertNull(pagination.getValue().getCursor());
    }

    @Test
    void listAcceptsTheLimitBoundaries() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        stubEmptyPage(principal);

        mockMvc.perform(get(BASE).param("limit", "1")).andExpect(status().isOk());
        mockMvc.perform(get(BASE).param("limit", "100")).andExpect(status().isOk());

        ArgumentCaptor<CursorPaginationCriteria> pagination = ArgumentCaptor.forClass(CursorPaginationCriteria.class);
        verify(ticketService, times(2)).getTickets(same(principal), any(), pagination.capture(), any(), any());
        assertEquals(List.of(1, 100), pagination.getAllValues().stream().map(CursorPaginationCriteria::getLimit).toList());
    }

    @Test
    void listWithLimitAboveMaxIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE).param("limit", "101"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(ticketService, ticketReadService);
    }

    @Test
    void listWithLimitBelowMinIs400AndNeverReachesTheDomain() throws Exception {
        mockMvc.perform(get(BASE).param("limit", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(ticketService, ticketReadService);
    }

    @Test
    void listWithNonNumericLimitIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("limit", "many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(ticketService, ticketReadService);
    }

    @Test
    void listWithUnknownLegacyStatusIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE).param("statuses", "BOGUS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(ticketService, ticketReadService);
    }

    @Test
    void listWithMalformedCursorIs400AndNeverReachesTheDomain() throws Exception {
        resolvedPrincipal();

        mockMvc.perform(get(BASE).param("cursor", "not-a-ticket-id"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Invalid cursor: not-a-ticket-id"));

        verifyNoInteractions(ticketService, ticketReadService);
    }

    @Test
    void filtersReturnOptionsAndPassQueryParamsIntoTheFilter() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        TicketFilters filters = TicketFilters.builder()
                .statuses(List.of(new TicketFilterOption("st-1", "Open")))
                .organizationIds(List.of(new TicketFilterOption("org-1", "Acme")))
                .assigneeIds(List.of(new TicketFilterOption("user-2", "Tim Tech")))
                .tagIds(List.of(new TicketFilterOption("tag-1", "vip")))
                .build();
        when(ticketFilterService.getFilters(same(principal), any())).thenReturn(CompletableFuture.completedFuture(filters));

        mockMvc.perform(get(BASE + "/filters")
                        .param("statuses", "ON_HOLD")
                        .param("statusIds", "st-1")
                        .param("customerIds", "org-1")
                        .param("assigneeIds", "user-2")
                        .param("tagIds", "tag-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.statuses[0].value").value("st-1"))
                .andExpect(jsonPath("$.statuses[0].label").value("Open"))
                .andExpect(jsonPath("$.customerIds[0].value").value("org-1"))
                .andExpect(jsonPath("$.customerIds[0].label").value("Acme"))
                .andExpect(jsonPath("$.assigneeIds[0].value").value("user-2"))
                .andExpect(jsonPath("$.tagIds[0].label").value("vip"));

        ArgumentCaptor<TicketFilterInput> filter = ArgumentCaptor.forClass(TicketFilterInput.class);
        verify(ticketFilterService).getFilters(same(principal), filter.capture());
        assertEquals(TicketFilterInput.builder()
                .statuses(List.of(TicketStatus.ON_HOLD))
                .statusIds(List.of("st-1"))
                .organizationIds(List.of("org-1"))
                .assigneeIds(List.of("user-2"))
                .tagIds(List.of("tag-1"))
                .build(), filter.getValue());
    }

    @Test
    void filtersWithUnknownLegacyStatusIs400TypeMismatch() throws Exception {
        mockMvc.perform(get(BASE + "/filters").param("statuses", "BOGUS"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TYPE_MISMATCH"));

        verifyNoInteractions(ticketFilterService);
    }

    @Test
    void statusesAreListedInServiceOrderForAResolvedCaller() throws Exception {
        resolvedPrincipal();
        when(ticketStatusService.list()).thenReturn(List.of(
                TicketStatusDefinition.builder().id("st-ai").kind(TicketStatusKind.AI_ASSISTANCE).name("AI").position("a0").build(),
                TicketStatusDefinition.builder().id("st-1").kind(TicketStatusKind.CUSTOM).name("Open").color("#00ff00").build()));

        mockMvc.perform(get(BASE + "/statuses"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].id").value("st-ai"))
                .andExpect(jsonPath("$[0].kind").value("AI_ASSISTANCE"))
                .andExpect(jsonPath("$[0].isSystem").value(true))
                .andExpect(jsonPath("$[0].systemKey").value("AI_ASSISTANCE"))
                .andExpect(jsonPath("$[0].position").value("a0"))
                .andExpect(jsonPath("$[1].id").value("st-1"))
                .andExpect(jsonPath("$[1].name").value("Open"))
                .andExpect(jsonPath("$[1].color").value("#00ff00"))
                .andExpect(jsonPath("$[1].isSystem").value(false))
                .andExpect(jsonPath("$[1].systemKey").doesNotExist());

        verify(principalResolver).resolve(USER_ID);
    }

    @Test
    void tagsAreListedForThePrincipal() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketTagService.getTags(same(principal))).thenReturn(List.of(
                Tag.builder().id("tag-1").key("vip").description("Very important").color("#ff0000")
                        .createdAt(CREATED_AT).createdBy("user-9").build()));

        mockMvc.perform(get(BASE + "/tags"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value("tag-1"))
                .andExpect(jsonPath("$[0].key").value("vip"))
                .andExpect(jsonPath("$[0].description").value("Very important"))
                .andExpect(jsonPath("$[0].color").value("#ff0000"))
                .andExpect(jsonPath("$[0].createdAt").value("2026-01-10T08:00:00.123Z"))
                .andExpect(jsonPath("$[0].createdBy").value("user-9"));
    }

    @Test
    void statisticsAreReturnedForThePrincipal() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketStatisticsService.getStatistics(same(principal))).thenReturn(TicketStatistics.builder()
                .totalCount(12)
                .statusCounts(List.of(new TicketStatusCount(TicketStatus.ACTIVE, 7)))
                .statusDefinitionCounts(List.of(new TicketStatusDefinitionCount(
                        TicketStatusDefinition.builder().id("st-1").kind(TicketStatusKind.CUSTOM).name("Open").build(), 5)))
                .averageResolutionTimeFormatted("2h 15m")
                .averageRating(4.5)
                .build());

        mockMvc.perform(get(BASE + "/statistics"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalCount").value(12))
                .andExpect(jsonPath("$.statusCounts[0].status").value("ACTIVE"))
                .andExpect(jsonPath("$.statusCounts[0].count").value(7))
                .andExpect(jsonPath("$.statusDefinitionCounts[0].status.id").value("st-1"))
                .andExpect(jsonPath("$.statusDefinitionCounts[0].status.name").value("Open"))
                .andExpect(jsonPath("$.statusDefinitionCounts[0].count").value(5))
                .andExpect(jsonPath("$.averageResolutionTimeFormatted").value("2h 15m"))
                .andExpect(jsonPath("$.averageRating").value(4.5));
    }

    @Test
    void ticketIsReadAndAssembledByTheReadService() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket ticket = ticket();
        when(ticketReadService.requireTicket(same(principal), eq(TICKET_ID))).thenReturn(ticket);
        when(ticketReadService.toResponse(same(principal), same(ticket))).thenReturn(ticketResponse());

        mockMvc.perform(get(BASE + "/" + TICKET_ID))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID))
                .andExpect(jsonPath("$.ticketNumber").value(42))
                .andExpect(jsonPath("$.title").value("Printer is on fire"))
                .andExpect(jsonPath("$.statusKind").value("TECH_REQUIRED"))
                .andExpect(jsonPath("$.customerId").value("org-1"))
                .andExpect(jsonPath("$.customerName").value("Acme"))
                .andExpect(jsonPath("$.aiDisabled").value(true))
                .andExpect(jsonPath("$.createdAt").value("2026-01-10T08:00:00.123Z"));
    }

    @Test
    void unknownTicketIs404WithTicketErrorCode() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketReadService.requireTicket(same(principal), eq("missing"))).thenThrow(new TicketNotFoundException("missing"));

        mockMvc.perform(get(BASE + "/missing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Ticket not found: missing"));

        verify(ticketReadService, never()).toResponse(any(), any());
    }

    @Test
    void createIs201AndMapsTheRequestOntoTheDomainInput() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket created = ticket();
        when(ticketService.createTicket(same(principal), any())).thenReturn(created);
        when(ticketReadService.toResponse(same(principal), same(created))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(post(BASE), body(
                        "title", "Printer is on fire",
                        "description", "Smoke everywhere",
                        "statusId", "st-1",
                        "deviceId", "machine-1",
                        "customerId", "org-1",
                        "assigneeId", "user-2",
                        "tagIds", List.of("tag-1", "tag-2"))))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(TICKET_ID))
                .andExpect(jsonPath("$.title").value("Printer is on fire"))
                .andExpect(jsonPath("$.customerId").value("org-1"));

        ArgumentCaptor<CreateTicketInput> input = ArgumentCaptor.forClass(CreateTicketInput.class);
        verify(ticketService).createTicket(same(principal), input.capture());
        assertEquals(CreateTicketInput.builder()
                .title("Printer is on fire")
                .description("Smoke everywhere")
                .statusId("st-1")
                .deviceId("machine-1")
                .organizationId("org-1")
                .assigneeId("user-2")
                .tagIds(List.of("tag-1", "tag-2"))
                .build(), input.getValue());
    }

    @Test
    void createWithOnlyATitleLeavesTheOptionalInputFieldsNull() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket created = ticket();
        when(ticketService.createTicket(same(principal), any())).thenReturn(created);
        when(ticketReadService.toResponse(same(principal), same(created))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(post(BASE), body("title", "T".repeat(255))))
                .andExpect(status().isCreated());

        ArgumentCaptor<CreateTicketInput> input = ArgumentCaptor.forClass(CreateTicketInput.class);
        verify(ticketService).createTicket(same(principal), input.capture());
        assertEquals(CreateTicketInput.builder().title("T".repeat(255)).build(), input.getValue());
    }

    @Test
    void createWithBlankTitleIs400WithFieldError() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE), body("title", "   ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Title is required"));

        verifyNoInteractions(ticketService, ticketReadService, principalResolver);
    }

    @Test
    void createWithoutTitleIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE), body("description", "no title")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createWithOversizeTitleIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE), body("title", "T".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createWithOversizeDescriptionIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE), body("title", "ok", "description", "d".repeat(5001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("description"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createWithTooManyTagsIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE), body("title", "ok", "tagIds", Collections.nCopies(21, "tag"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("tagIds"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createWithMalformedJsonIs400() throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON).content("{\"title\": "))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createWithoutBodyIs400() throws Exception {
        mockMvc.perform(post(BASE).contentType(MediaType.APPLICATION_JSON))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void createRejectedByTheDomainAsIllegalArgumentIs400() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketService.createTicket(same(principal), any()))
                .thenThrow(new IllegalArgumentException("Device doesn't belong to selected organization"));

        mockMvc.perform(jsonRequest(post(BASE), body("title", "ok", "deviceId", "machine-1", "customerId", "org-2")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BAD_REQUEST"))
                .andExpect(jsonPath("$.message").value("Device doesn't belong to selected organization"));

        verifyNoInteractions(ticketReadService);
    }

    @Test
    void updateMapsTheRequestOntoTheDomainInputWithThePathId() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket updated = ticket();
        when(ticketService.updateTicket(same(principal), eq(TICKET_ID), any())).thenReturn(updated);
        when(ticketReadService.toResponse(same(principal), same(updated))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(patch(BASE + "/" + TICKET_ID), body(
                        "title", "New title",
                        "description", "New description",
                        "deviceId", "machine-2",
                        "customerId", "org-2",
                        "assigneeId", "user-3",
                        "tagIds", List.of("tag-9"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));

        ArgumentCaptor<UpdateTicketInput> input = ArgumentCaptor.forClass(UpdateTicketInput.class);
        verify(ticketService).updateTicket(same(principal), eq(TICKET_ID), input.capture());
        assertEquals(UpdateTicketInput.builder()
                .id(TICKET_ID)
                .title("New title")
                .description("New description")
                .deviceId("machine-2")
                .organizationId("org-2")
                .assigneeId("user-3")
                .tagIds(List.of("tag-9"))
                .build(), input.getValue());
    }

    @Test
    void partialUpdateLeavesTheOmittedInputFieldsNull() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket updated = ticket();
        when(ticketService.updateTicket(same(principal), eq(TICKET_ID), any())).thenReturn(updated);
        when(ticketReadService.toResponse(same(principal), same(updated))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(patch(BASE + "/" + TICKET_ID), body("title", "Only the title")))
                .andExpect(status().isOk());

        ArgumentCaptor<UpdateTicketInput> input = ArgumentCaptor.forClass(UpdateTicketInput.class);
        verify(ticketService).updateTicket(same(principal), eq(TICKET_ID), input.capture());
        assertEquals(UpdateTicketInput.builder().id(TICKET_ID).title("Only the title").build(), input.getValue());
    }

    @Test
    void updateWithOversizeTitleIs400() throws Exception {
        mockMvc.perform(jsonRequest(patch(BASE + "/" + TICKET_ID), body("title", "T".repeat(256))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("title"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void updateWithOversizeDescriptionOrTooManyTagsIs400() throws Exception {
        mockMvc.perform(jsonRequest(patch(BASE + "/" + TICKET_ID), body("description", "d".repeat(5001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("description"));
        mockMvc.perform(jsonRequest(patch(BASE + "/" + TICKET_ID), body("tagIds", Collections.nCopies(21, "tag"))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("tagIds"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void updateOfUnknownTicketIs404() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketService.updateTicket(same(principal), eq("missing"), any()))
                .thenThrow(new TicketNotFoundException("missing"));

        mockMvc.perform(jsonRequest(patch(BASE + "/missing"), body("title", "x")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));

        verifyNoInteractions(ticketReadService);
    }

    @Test
    void transitionMapsThePathIdTargetStatusAndReason() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket transitioned = ticket();
        when(ticketLifecycleService.transition(same(principal), any())).thenReturn(transitioned);
        when(ticketReadService.toResponse(same(principal), same(transitioned))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/transition"),
                        body("toStatusId", "st-resolved", "reason", "Fixed on site")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));

        ArgumentCaptor<TransitionTicketInput> input = ArgumentCaptor.forClass(TransitionTicketInput.class);
        verify(ticketLifecycleService).transition(same(principal), input.capture());
        assertEquals(TransitionTicketInput.builder()
                .ticketId(TICKET_ID)
                .toStatusId("st-resolved")
                .reason("Fixed on site")
                .build(), input.getValue());
    }

    @Test
    void transitionWithoutTargetStatusIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/transition"), body("toStatusId", " ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("toStatusId"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("toStatusId is required"));

        verifyNoInteractions(ticketLifecycleService);
    }

    @Test
    void transitionWithOversizeReasonIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/transition"),
                        body("toStatusId", "st-resolved", "reason", "r".repeat(501))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("reason"));

        verifyNoInteractions(ticketLifecycleService);
    }

    @Test
    void transitionNotAllowedFromTheCurrentStatusIs409() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketLifecycleService.transition(same(principal), any())).thenThrow(new InvalidTicketTransitionException(
                TicketStatusKind.ARCHIVED, TicketStatusKind.TECH_REQUIRED, List.of("st-resolved")));

        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/transition"), body("toStatusId", "st-tech")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("TICKET_INVALID_TRANSITION"));

        verifyNoInteractions(ticketReadService);
    }

    @Test
    void transitionToUnknownStatusIs404WithStatusErrorCode() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketLifecycleService.transition(same(principal), any()))
                .thenThrow(new TicketStatusNotFoundException("st-missing"));

        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/transition"), body("toStatusId", "st-missing")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_STATUS_NOT_FOUND"));
    }

    @Test
    void transitionOfUnknownTicketIs404() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketLifecycleService.transition(same(principal), any())).thenThrow(new TicketNotFoundException("missing"));

        mockMvc.perform(jsonRequest(post(BASE + "/missing/transition"), body("toStatusId", "st-1")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));
    }

    @Test
    void assignPassesTheAssigneeToTheDomain() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket assigned = ticket();
        when(ticketService.assignTicket(same(principal), eq(TICKET_ID), eq("user-2"))).thenReturn(assigned);
        when(ticketReadService.toResponse(same(principal), same(assigned))).thenReturn(ticketResponse());

        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/assignee"), body("assigneeId", "user-2")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID))
                .andExpect(jsonPath("$.assignedTo").value("user-2"));
    }

    @Test
    void assignWithoutAssigneeIs400() throws Exception {
        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/assignee"), body("assigneeId", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("assigneeId"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("assigneeId is required"));

        verifyNoInteractions(ticketService);
    }

    @Test
    void unassignReturnsTheUpdatedTicket() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket unassigned = ticket();
        when(ticketService.unassignTicket(same(principal), eq(TICKET_ID))).thenReturn(unassigned);
        when(ticketReadService.toResponse(same(principal), same(unassigned))).thenReturn(ticketResponse());

        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/assignee"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));
    }

    @Test
    void unlinkDeviceReturnsTheUpdatedTicket() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket unlinked = ticket();
        when(ticketService.unlinkDeviceFromTicket(same(principal), eq(TICKET_ID))).thenReturn(unlinked);
        when(ticketReadService.toResponse(same(principal), same(unlinked))).thenReturn(ticketResponse());

        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/device"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));
    }

    @Test
    void unlinkCustomerUnlinksTheOrganizationInTheDomain() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket unlinked = ticket();
        when(ticketService.unlinkOrganizationFromTicket(same(principal), eq(TICKET_ID))).thenReturn(unlinked);
        when(ticketReadService.toResponse(same(principal), same(unlinked))).thenReturn(ticketResponse());

        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/customer"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));
    }

    @Test
    void addTagAssignsItAndThenReturnsTheReloadedTicket() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket ticket = ticket();
        when(ticketReadService.requireTicket(same(principal), eq(TICKET_ID))).thenReturn(ticket);
        when(ticketReadService.toResponse(same(principal), same(ticket))).thenReturn(ticketResponse());

        mockMvc.perform(post(BASE + "/" + TICKET_ID + "/tags/tag-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));

        InOrder order = inOrder(ticketTagService, ticketReadService);
        order.verify(ticketTagService).addTagToTicket(same(principal), eq(TICKET_ID), eq("tag-1"));
        order.verify(ticketReadService).toResponse(same(principal), same(ticket));
    }

    @ParameterizedTest
    @ValueSource(strings = {"POST", "DELETE"})
    void tagChangeOnUnknownTicketIs404AndNothingIsChanged(String method) throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketReadService.requireTicket(same(principal), eq("missing"))).thenThrow(new TicketNotFoundException("missing"));

        mockMvc.perform(request(HttpMethod.valueOf(method), BASE + "/missing/tags/tag-1"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));

        verifyNoInteractions(ticketTagService);
    }

    @Test
    void removeTagUnassignsItAndThenReturnsTheReloadedTicket() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        Ticket ticket = ticket();
        when(ticketReadService.requireTicket(same(principal), eq(TICKET_ID))).thenReturn(ticket);
        when(ticketReadService.toResponse(same(principal), same(ticket))).thenReturn(ticketResponse());

        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/tags/tag-1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(TICKET_ID));

        InOrder order = inOrder(ticketTagService, ticketReadService);
        order.verify(ticketTagService).removeTagFromTicket(same(principal), eq(TICKET_ID), eq("tag-1"));
        order.verify(ticketReadService).toResponse(same(principal), same(ticket));
    }

    @Test
    void addNoteIs201WithTheCreatedNote() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketNoteService.addNote(same(principal), eq(TICKET_ID), eq("Called the customer")))
                .thenReturn(note("Called the customer"));

        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/notes"), body("content", "Called the customer")))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value("n-1"))
                .andExpect(jsonPath("$.ticketId").value(TICKET_ID))
                .andExpect(jsonPath("$.content").value("Called the customer"))
                .andExpect(jsonPath("$.authorId").value(USER_ID))
                .andExpect(jsonPath("$.createdAt").value("2026-01-10T08:00:00.123Z"));
    }

    @Test
    void addNoteWithBlankContentIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/notes"), body("content", " ")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("content"))
                .andExpect(jsonPath("$.fieldErrors[0].message").value("Content is required"));

        verifyNoInteractions(ticketNoteService);
    }

    @Test
    void addNoteWithOversizeContentIs400() throws Exception {
        mockMvc.perform(jsonRequest(post(BASE + "/" + TICKET_ID + "/notes"), body("content", "c".repeat(5001))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("content"));

        verifyNoInteractions(ticketNoteService);
    }

    @Test
    void updateNotePassesTheNoteIdAndContentToTheDomain() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketNoteService.updateNote(same(principal), eq("n-1"), eq("Edited"))).thenReturn(note("Edited"));

        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/notes/n-1"), body("content", "Edited")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("n-1"))
                .andExpect(jsonPath("$.content").value("Edited"));
    }

    @Test
    void addNoteToUnknownTicketIs404AndNothingIsCreated() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketReadService.requireTicket(same(principal), eq("missing"))).thenThrow(new TicketNotFoundException("missing"));

        mockMvc.perform(jsonRequest(post(BASE + "/missing/notes"), body("content", "Hello")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOT_FOUND"));

        verifyNoInteractions(ticketNoteService);
    }

    @Test
    void noteIsLookedUpUnderTheTicketFromThePathBeforeItIsChanged() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketNoteService.updateNote(same(principal), eq("n-1"), eq("Edited"))).thenReturn(note("Edited"));

        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/notes/n-1"), body("content", "Edited")))
                .andExpect(status().isOk());
        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/notes/n-1"))
                .andExpect(status().isNoContent());

        verify(ticketReadService, times(2)).requireNote(TICKET_ID, "n-1");
    }

    @ParameterizedTest
    @ValueSource(strings = {"PUT", "DELETE"})
    void noteOfAnotherTicketIs404AndNothingIsChanged(String method) throws Exception {
        resolvedPrincipal();
        when(ticketReadService.requireNote(TICKET_ID, "n-1")).thenThrow(new TicketNoteNotFoundException("n-1"));

        mockMvc.perform(jsonRequest(request(HttpMethod.valueOf(method), BASE + "/" + TICKET_ID + "/notes/n-1"),
                        body("content", "Edited")))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("TICKET_NOTE_NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Ticket note not found: n-1"));

        verifyNoInteractions(ticketNoteService);
    }

    @Test
    void updateNoteWithBlankContentIs400() throws Exception {
        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/notes/n-1"), body("content", "")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        verifyNoInteractions(ticketNoteService);
    }

    @Test
    void updateNoteByNonAuthorIs409() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();
        when(ticketNoteService.updateNote(same(principal), eq("n-1"), eq("Edited")))
                .thenThrow(new IllegalStateException("Only the author can update this note"));

        mockMvc.perform(jsonRequest(put(BASE + "/" + TICKET_ID + "/notes/n-1"), body("content", "Edited")))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(jsonPath("$.message").value("Only the author can update this note"));
    }

    @Test
    void deleteNoteIs204WithoutBody() throws Exception {
        AuthPrincipal principal = resolvedPrincipal();

        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/notes/n-1"))
                .andExpect(status().isNoContent())
                .andExpect(content().string(""));

        verify(ticketNoteService).deleteNote(same(principal), eq("n-1"));
    }

    @Test
    void unresolvableApiKeyOwnerIs401OnReadsAndNeverReachesTheDomain() throws Exception {
        when(principalResolver.resolve(USER_ID)).thenThrow(new UnauthorizedException("API key owner not found"));

        mockMvc.perform(get(BASE))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.message").value("API key owner not found"));
        mockMvc.perform(get(BASE + "/statuses"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(ticketService, ticketStatusService, ticketReadService);
    }

    @Test
    void inactiveApiKeyOwnerIs403OnWritesAndNeverReachesTheDomain() throws Exception {
        when(principalResolver.resolve(USER_ID)).thenThrow(new ForbiddenException("API key owner is not active"));

        mockMvc.perform(jsonRequest(post(BASE), body("title", "Printer is on fire")))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("API key owner is not active"));
        mockMvc.perform(delete(BASE + "/" + TICKET_ID + "/notes/n-1"))
                .andExpect(status().isForbidden());

        verifyNoInteractions(ticketService, ticketNoteService, ticketReadService);
    }

    private AuthPrincipal resolvedPrincipal() {
        AuthPrincipal principal = AuthPrincipal.builder().id(USER_ID).email("owner@example.com").build();
        when(principalResolver.resolve(USER_ID)).thenReturn(principal);
        return principal;
    }

    private void stubEmptyPage(AuthPrincipal principal) {
        List<Ticket> items = List.of();
        when(ticketService.getTickets(same(principal), any(), any(), any(), any()))
                .thenReturn(CountedGenericQueryResult.<Ticket>builder()
                        .items(items)
                        .pageInfo(PageInfo.builder().build())
                        .filteredCount(0)
                        .build());
        when(ticketReadService.toResponses(same(principal), same(items))).thenReturn(List.of());
    }

    private static Ticket ticket() {
        return Ticket.builder().id(TICKET_ID).ticketNumber(42).title("Printer is on fire").build();
    }

    private static TicketResponse ticketResponse() {
        return TicketResponse.builder()
                .id(TICKET_ID)
                .ticketNumber(42)
                .title("Printer is on fire")
                .statusKind(TicketStatusKind.TECH_REQUIRED)
                .customerId("org-1")
                .customerName("Acme")
                .assignedTo("user-2")
                .aiDisabled(true)
                .createdAt(CREATED_AT)
                .build();
    }

    private static TicketNote note(String content) {
        return TicketNote.builder()
                .id("n-1")
                .ticketId(TICKET_ID)
                .content(content)
                .authorId(USER_ID)
                .createdAt(CREATED_AT)
                .updatedAt(CREATED_AT)
                .build();
    }

    private static Map<String, Object> body(Object... keysAndValues) {
        Map<String, Object> body = new LinkedHashMap<>();
        for (int i = 0; i < keysAndValues.length; i += 2) {
            body.put((String) keysAndValues[i], keysAndValues[i + 1]);
        }
        return body;
    }

    private static MockHttpServletRequestBuilder jsonRequest(MockHttpServletRequestBuilder request, Map<String, Object> body)
            throws Exception {
        return request.contentType(MediaType.APPLICATION_JSON)
                .content(ExternalApiMockMvc.objectMapper().writeValueAsString(body));
    }
}
