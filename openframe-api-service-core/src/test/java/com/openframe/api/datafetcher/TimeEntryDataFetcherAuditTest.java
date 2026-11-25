package com.openframe.api.datafetcher;

import com.openframe.api.dto.timetracking.CreateTimeEntryInput;
import com.openframe.api.dto.timetracking.UpdateTimeEntryInput;
import com.openframe.api.service.TimeEntryService;
import com.openframe.audit.AuditCall;
import com.openframe.audit.AuditedMethodRunner;
import com.openframe.data.document.timetracking.TimeEntry;
import com.openframe.graphql.relay.RelayIdCodec;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.graphql.relay.NodeType.ORGANIZATION;
import static com.openframe.graphql.relay.NodeType.TICKET;
import static com.openframe.graphql.relay.NodeType.TIME_ENTRY;
import static com.openframe.graphql.relay.NodeType.USER;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimeEntryDataFetcherAuditTest {

    private static final RelayIdCodec CODEC = new RelayIdCodec();
    private static final Instant STARTED_AT = Instant.parse("2026-11-20T09:00:00Z");
    private static final String TICKET_CLEAR_SENTINEL = "VGlja2V0Og";
    private static final Map<String, Object> OWNER_TICKET_DURATION_AND_START = Map.of(
            "userId", "employee-1", "ticketIds", List.of("ticket-1"), "durationSeconds", 7200L,
            "startedAt", STARTED_AT);
    private static final TimeEntry SAVED_ENTRY = TimeEntry.builder().id("entry-1").build();

    @Mock private TimeEntryService timeEntryService;
    @Mock private AuditedMethodRunner auditedMethodRunner;
    @Captor private ArgumentCaptor<AuditCall> callCaptor;
    private TimeEntryDataFetcher dataFetcher;

    @BeforeEach
    void setUp() {
        dataFetcher = new TimeEntryDataFetcher(timeEntryService, CODEC, auditedMethodRunner);
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none").claim("sub", "user-1").build();
        SecurityContextHolder.getContext()
                .setAuthentication(new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES));
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void createTimeEntry_refused_keepsTheAskedOwnerTicketDurationAndStart() {
        dataFetcher.createTimeEntry(createInput());

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(OWNER_TICKET_DURATION_AND_START);
    }

    @Test
    void createTimeEntry_refused_filesTheEventUnderTheAskedCustomer() {
        dataFetcher.createTimeEntry(createInput());

        assertThat(capturedCall().organizationIdOf().apply(null)).isEqualTo("org-1");
    }

    @Test
    void createTimeEntry_created_doesNotFileTheEventUnderTheAskedCustomer() {
        dataFetcher.createTimeEntry(createInput());

        assertThat(capturedCall().organizationIdOf().apply(SAVED_ENTRY)).isNull();
    }

    @Test
    void updateTimeEntry_refused_keepsTheAskedOwnerTicketDurationAndStart() {
        dataFetcher.updateTimeEntry(updateInput(CODEC.encode(TICKET, "ticket-1")));

        assertThat(capturedCall().detailsFromResult().apply(null))
                .containsExactlyInAnyOrderEntriesOf(OWNER_TICKET_DURATION_AND_START);
    }

    @Test
    void updateTimeEntry_refusedTicketRemoval_keepsNoTicketIds() {
        dataFetcher.updateTimeEntry(updateInput(TICKET_CLEAR_SENTINEL));

        assertThat(capturedCall().detailsFromResult().apply(null)).extractingByKey("ticketIds").isNull();
    }

    @Test
    void updateTimeEntry_saved_storesNoDetails() {
        dataFetcher.updateTimeEntry(updateInput(CODEC.encode(TICKET, "ticket-1")));

        assertThat(capturedCall().detailsFromResult().apply(SAVED_ENTRY)).isNull();
    }

    @Test
    void deleteTimeEntry_entryOfAnotherTechnician_keepsItsOwnerTicketDurationAndStart() {
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        when(timeEntryService.getTimeEntry("entry-1")).thenReturn(Optional.of(TimeEntry.builder()
                .id("entry-1").userId("employee-1").ticketId("ticket-1").durationSeconds(7200)
                .startedAt(STARTED_AT).build()));

        assertThat(deleteCall().detailsFromResult().apply(true))
                .containsExactlyInAnyOrderEntriesOf(OWNER_TICKET_DURATION_AND_START);
    }

    @Test
    void deleteTimeEntry_entryAlreadyGone_runsWithoutDetails() {
        when(auditedMethodRunner.isEnabled()).thenReturn(true);
        when(timeEntryService.getTimeEntry("entry-1")).thenReturn(Optional.empty());

        assertThat(deleteCall().detailsFromResult().apply(false)).isNull();
    }

    @Test
    void deleteTimeEntry_nothingDeleted_storesNoEvent() {
        assertThat(deleteCall().storeIf().test(false)).isFalse();
    }

    private AuditCall deleteCall() {
        when(auditedMethodRunner.run(any(AuditCall.class), any())).thenReturn(true);
        dataFetcher.deleteTimeEntry(CODEC.encode(TIME_ENTRY, "entry-1"));
        return capturedCall();
    }

    private AuditCall capturedCall() {
        verify(auditedMethodRunner).run(callCaptor.capture(), any());
        return callCaptor.getValue();
    }

    private static CreateTimeEntryInput createInput() {
        return CreateTimeEntryInput.builder()
                .userId(CODEC.encode(USER, "employee-1"))
                .ticketId(CODEC.encode(TICKET, "ticket-1"))
                .organizationId(CODEC.encode(ORGANIZATION, "org-1"))
                .startedAt(STARTED_AT)
                .durationSeconds(7200)
                .build();
    }

    private static UpdateTimeEntryInput updateInput(String ticketId) {
        return UpdateTimeEntryInput.builder()
                .id(CODEC.encode(TIME_ENTRY, "entry-1"))
                .userId(CODEC.encode(USER, "employee-1"))
                .ticketId(ticketId)
                .startedAt(STARTED_AT)
                .durationSeconds(7200L)
                .build();
    }
}
