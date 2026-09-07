package com.openframe.api.service.ticket;

import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.filter.TicketActivityCriteria;
import com.openframe.data.document.ticket.filter.TicketActivityFilter;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class TicketStalenessResolverTest {

    private static final int DEFAULT_MINUTES = 120;
    private static final int TRIAGE_MINUTES = 30;
    private static final String TRIAGE_STATUS_ID = "status-triage";
    private static final String PROGRESS_STATUS_ID = "status-progress";

    @Mock private TicketStatusService ticketStatusService;

    @InjectMocks private TicketStalenessResolver resolver;

    private TicketStalenessProperties properties;
    private TicketStatusDefinition triageStatus;
    private TicketStatusDefinition progressStatus;

    @BeforeEach
    void setUp() {
        properties = new TicketStalenessProperties();
        properties.setDefaultMinutes(DEFAULT_MINUTES);
        resolver = new TicketStalenessResolver(ticketStatusService, properties);

        triageStatus = TicketStatusDefinition.builder()
                .id(TRIAGE_STATUS_ID)
                .staleAfterMinutes(TRIAGE_MINUTES)
                .build();
        progressStatus = TicketStatusDefinition.builder()
                .id(PROGRESS_STATUS_ID)
                .build();
    }

    @Test
    void effectiveStaleAfterMinutes_statusOverridesThreshold_overrideReturned() {
        // setup — triage carries its own threshold

        // execution
        int minutes = resolver.effectiveStaleAfterMinutes(triageStatus);

        // verifications
        assertThat(minutes).isEqualTo(TRIAGE_MINUTES);
    }

    @Test
    void effectiveStaleAfterMinutes_statusWithoutThreshold_defaultReturned() {
        // setup — progress leaves the threshold unset

        // execution
        int minutes = resolver.effectiveStaleAfterMinutes(progressStatus);

        // verifications
        assertThat(minutes).isEqualTo(DEFAULT_MINUTES);
    }

    @ParameterizedTest
    @NullSource
    void effectiveStaleAfterMinutes_nullStatus_defaultReturned(TicketStatusDefinition definition) {
        // setup — a status deleted mid-query resolves to null

        // execution
        int minutes = resolver.effectiveStaleAfterMinutes(definition);

        // verifications
        assertThat(minutes).isEqualTo(DEFAULT_MINUTES);
    }

    @Test
    void resolve_noFiltersRequested_nullReturnedAndStatusesNotRead() {
        // setup — nothing requested

        // execution
        TicketActivityCriteria criteria = resolver.resolve(List.of());

        // verifications
        assertThat(criteria).isNull();
        verify(ticketStatusService, never()).list();
    }

    @ParameterizedTest
    @NullSource
    void resolve_nullFilters_nullReturned(List<TicketActivityFilter> filters) {
        // setup — the filter was omitted entirely

        // execution
        TicketActivityCriteria criteria = resolver.resolve(filters);

        // verifications
        assertThat(criteria).isNull();
        verify(ticketStatusService, never()).list();
    }

    @Test
    void resolve_staleRequested_cutoffPerStatusResolved() {
        // setup
        when(ticketStatusService.list()).thenReturn(List.of(triageStatus, progressStatus));
        Instant before = Instant.now();

        // execution
        TicketActivityCriteria criteria = resolver.resolve(List.of(TicketActivityFilter.STALE));

        // verifications
        assertThat(criteria.staleCutoffByStatusId())
                .containsKeys(TRIAGE_STATUS_ID, PROGRESS_STATUS_ID);
        assertThat(criteria.staleCutoffByStatusId().get(TRIAGE_STATUS_ID))
                .isAfter(criteria.staleCutoffByStatusId().get(PROGRESS_STATUS_ID));
        assertThat(criteria.defaultStaleCutoff())
                .isBeforeOrEqualTo(before.minus(DEFAULT_MINUTES, ChronoUnit.MINUTES).plusSeconds(1));
    }

    @Test
    void resolve_awaitingExternalOnly_statusThresholdsNotRead() {
        // setup — awaiting needs no threshold at all

        // execution
        TicketActivityCriteria criteria = resolver.resolve(List.of(TicketActivityFilter.AWAITING_EXTERNAL));

        // verifications
        assertThat(criteria.staleCutoffByStatusId()).isEmpty();
        verify(ticketStatusService, never()).list();
    }

    @Test
    void resolve_multipleFiltersRequested_allRetained() {
        // setup
        when(ticketStatusService.list()).thenReturn(List.of(triageStatus));

        // execution
        TicketActivityCriteria criteria = resolver.resolve(
                List.of(TicketActivityFilter.STALE, TicketActivityFilter.AWAITING_EXTERNAL));

        // verifications
        assertThat(criteria.filters())
                .containsExactlyInAnyOrder(TicketActivityFilter.STALE, TicketActivityFilter.AWAITING_EXTERNAL);
        assertThat(criteria.has(TicketActivityFilter.ACTIVE)).isFalse();
    }
}
