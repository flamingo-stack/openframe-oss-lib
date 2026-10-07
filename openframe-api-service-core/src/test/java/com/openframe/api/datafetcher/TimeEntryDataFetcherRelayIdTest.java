package com.openframe.api.datafetcher;

import com.netflix.graphql.dgs.DgsDataFetchingEnvironment;
import com.openframe.api.dto.timetracking.CreateTimeEntryCommand;
import com.openframe.api.dto.timetracking.CreateTimeEntryInput;
import com.openframe.api.dto.timetracking.StartTimerCommand;
import com.openframe.api.dto.timetracking.StartTimerInput;
import com.openframe.api.dto.timetracking.StopTimerCommand;
import com.openframe.api.dto.timetracking.StopTimerInput;
import com.openframe.api.dto.timetracking.TimeEntryFilterInput;
import com.openframe.api.dto.timetracking.UpdateTimeEntryCommand;
import com.openframe.api.dto.timetracking.UpdateTimeEntryInput;
import com.openframe.api.relay.InvalidRelayIdException;
import com.openframe.api.relay.NodeType;
import com.openframe.api.relay.RelayIdCodec;
import com.openframe.api.service.TimeEntryService;
import com.openframe.data.document.timetracking.TimeEntry;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TimeEntryDataFetcherRelayIdTest {

    private static final String ACTING_USER_ID = "user-1";
    private static final String RAW_TICKET_ID = "ticket-1";
    private static final String RAW_ORGANIZATION_ID = "org-1";
    private static final String RAW_ENTRY_ID = "entry-1";
    private static final String RAW_EMPLOYEE_ID = "employee-1";
    private static final String CLEARED = "";
    private static final String NOTES = "notes";
    private static final String UNPADDED_TICKET_SENTINEL = "VGlja2V0Og";
    private static final String PADDED_TICKET_SENTINEL = "VGlja2V0Og==";
    private static final String UNPADDED_ORGANIZATION_SENTINEL = "T3JnYW5pemF0aW9uOg";
    private static final String PADDED_ORGANIZATION_SENTINEL = "T3JnYW5pemF0aW9uOg==";

    @Mock private TimeEntryService timeEntryService;
    @Mock private DgsDataFetchingEnvironment dfe;
    @Spy private RelayIdCodec relayIdCodec = new RelayIdCodec();

    @InjectMocks private TimeEntryDataFetcher dataFetcher;

    private final RelayIdCodec codec = new RelayIdCodec();

    @BeforeEach
    void signIn() {
        Jwt jwt = Jwt.withTokenValue("token")
                .header("alg", "none")
                .claim("sub", ACTING_USER_ID)
                .build();
        JwtAuthenticationToken authentication = new JwtAuthenticationToken(jwt, AuthorityUtils.NO_AUTHORITIES);
        SecurityContextHolder.getContext().setAuthentication(authentication);
    }

    @AfterEach
    void signOut() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void startTimer_globalIds_rawIdsPassedToService() {
        // setup
        String ticketId = codec.encode(NodeType.TICKET, RAW_TICKET_ID);
        String organizationId = codec.encode(NodeType.ORGANIZATION, RAW_ORGANIZATION_ID);
        StartTimerInput input = new StartTimerInput(ticketId, organizationId, NOTES);
        StartTimerCommand expected = new StartTimerCommand(RAW_TICKET_ID, RAW_ORGANIZATION_ID, NOTES);

        // execution
        dataFetcher.startTimer(input);

        // verifications
        verify(timeEntryService).startTimer(ACTING_USER_ID, expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {UNPADDED_TICKET_SENTINEL, PADDED_TICKET_SENTINEL})
    void startTimer_ticketClearSentinel_blankTicketIdPassedToService(String ticketSentinel) {
        // setup
        StartTimerInput input = new StartTimerInput(ticketSentinel, null, NOTES);
        StartTimerCommand expected = new StartTimerCommand(CLEARED, null, NOTES);

        // execution
        dataFetcher.startTimer(input);

        // verifications
        verify(timeEntryService).startTimer(ACTING_USER_ID, expected);
    }

    @ParameterizedTest
    @ValueSource(strings = {UNPADDED_ORGANIZATION_SENTINEL, PADDED_ORGANIZATION_SENTINEL})
    void stopTimer_organizationClearSentinel_blankOrganizationIdPassedToService(String organizationSentinel) {
        // setup
        StopTimerInput input = new StopTimerInput(null, organizationSentinel, NOTES);
        StopTimerCommand expected = new StopTimerCommand(null, CLEARED, NOTES);

        // execution
        dataFetcher.stopTimer(input);

        // verifications
        verify(timeEntryService).stopTimer(ACTING_USER_ID, expected);
    }

    @Test
    void startTimer_organizationSentinelAsTicketId_throwsInvalidRelayId() {
        // setup
        StartTimerInput input = new StartTimerInput(UNPADDED_ORGANIZATION_SENTINEL, null, NOTES);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.startTimer(input));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a Ticket id, got Organization");
        verifyNoInteractions(timeEntryService);
    }

    @Test
    void createTimeEntry_globalIdsAndClearSentinels_decodedForService() {
        // setup
        String userId = codec.encode(NodeType.USER, RAW_EMPLOYEE_ID);
        CreateTimeEntryInput input = CreateTimeEntryInput.builder()
                .userId(userId)
                .ticketId(PADDED_TICKET_SENTINEL)
                .organizationId(UNPADDED_ORGANIZATION_SENTINEL)
                .notes(NOTES)
                .build();
        CreateTimeEntryCommand expected = CreateTimeEntryCommand.builder()
                .userId(RAW_EMPLOYEE_ID)
                .ticketId(CLEARED)
                .organizationId(CLEARED)
                .notes(NOTES)
                .build();

        // execution
        dataFetcher.createTimeEntry(input);

        // verifications
        verify(timeEntryService).createTimeEntry(ACTING_USER_ID, expected);
    }

    @Test
    void updateTimeEntry_globalIds_decodedForService() {
        // setup
        String entryId = codec.encode(NodeType.TIME_ENTRY, RAW_ENTRY_ID);
        String userId = codec.encode(NodeType.USER, RAW_EMPLOYEE_ID);
        String ticketId = codec.encode(NodeType.TICKET, RAW_TICKET_ID);
        UpdateTimeEntryInput input = UpdateTimeEntryInput.builder()
                .id(entryId)
                .userId(userId)
                .ticketId(ticketId)
                .organizationId(PADDED_ORGANIZATION_SENTINEL)
                .build();
        UpdateTimeEntryCommand expected = UpdateTimeEntryCommand.builder()
                .id(RAW_ENTRY_ID)
                .userId(RAW_EMPLOYEE_ID)
                .ticketId(RAW_TICKET_ID)
                .organizationId(CLEARED)
                .build();

        // execution
        dataFetcher.updateTimeEntry(input);

        // verifications
        verify(timeEntryService).updateTimeEntry(ACTING_USER_ID, expected);
    }

    @Test
    void deleteTimeEntry_ticketGlobalId_throwsInvalidRelayId() {
        // setup
        String ticketId = codec.encode(NodeType.TICKET, RAW_TICKET_ID);

        // execution
        InvalidRelayIdException exception = assertThrows(InvalidRelayIdException.class,
                () -> dataFetcher.deleteTimeEntry(ticketId));

        // verifications
        assertThat(exception.getMessage()).isEqualTo("Expected a TimeEntry id, got Ticket");
        verifyNoInteractions(timeEntryService);
    }

    @Test
    void employeeTimeStats_globalFilterIds_decodedForService() {
        // setup
        String employeeId = codec.encode(NodeType.USER, RAW_EMPLOYEE_ID);
        String organizationId = codec.encode(NodeType.ORGANIZATION, RAW_ORGANIZATION_ID);
        TimeEntryFilterInput filter = TimeEntryFilterInput.builder()
                .employeeIds(List.of(employeeId))
                .organizationIds(List.of(organizationId))
                .build();
        TimeEntryFilterInput expected = TimeEntryFilterInput.builder()
                .employeeIds(List.of(RAW_EMPLOYEE_ID))
                .organizationIds(List.of(RAW_ORGANIZATION_ID))
                .build();

        // execution
        dataFetcher.employeeTimeStats(filter);

        // verifications
        verify(timeEntryService).getEmployeeTimeStats(expected);
    }

    @Test
    void timeEntryNodeId_entry_timeEntryGlobalId() {
        // setup
        TimeEntry entry = TimeEntry.builder().id(RAW_ENTRY_ID).build();
        when(dfe.<TimeEntry>getSource()).thenReturn(entry);

        // execution
        String nodeId = dataFetcher.timeEntryNodeId(dfe);

        // verifications
        assertThat(nodeId).isEqualTo("VGltZUVudHJ5OmVudHJ5LTE");
    }
}
