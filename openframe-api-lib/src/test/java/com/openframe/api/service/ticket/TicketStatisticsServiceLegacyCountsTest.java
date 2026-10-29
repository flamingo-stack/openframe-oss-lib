package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.api.dto.ticket.TicketStatusCount;
import com.openframe.api.service.ticket.spi.TicketRatingProvider;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.data.document.ticket.TicketStatusDefinition;
import com.openframe.data.document.ticket.TicketStatusKind;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.ActorType;
import com.openframe.security.authentication.AuthPrincipal;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.groups.Tuple.tuple;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

/**
 * Clients built before the lifecycle rollout read the per-status counters keyed by the legacy enum.
 * They have been coming back empty since custom statuses shipped, which is why those clients show
 * zero tickets. The counts are folded down from the lifecycle ones instead: every custom column
 * lands in the bucket its kind maps to, so the totals still add up.
 */
@ExtendWith(MockitoExtension.class)
class TicketStatisticsServiceLegacyCountsTest {

    @Mock private TicketRepository ticketRepository;
    @Mock private TicketStatusService ticketStatusService;
    @Mock private ObjectProvider<TicketRatingProvider> ratingProvider;

    private TicketStatisticsService service;

    private final AuthPrincipal admin = AuthPrincipal.builder()
            .id("admin-1")
            .actorType(ActorType.ADMIN)
            .build();

    @BeforeEach
    void setUp() {
        service = new TicketStatisticsService(ticketRepository, ticketStatusService, ratingProvider);
        lenient().when(ticketRepository.getAverageResolutionTimeMs()).thenReturn(Optional.empty());
    }

    @Test
    void customColumnsFoldIntoTheTechRequiredBucket() {
        givenBoard(
                status("st-ai", TicketStatusKind.AI_ASSISTANCE, 3),
                status("st-tech", TicketStatusKind.TECH_REQUIRED, 1),
                status("st-waiting", TicketStatusKind.CUSTOM, 2));

        TicketStatistics statistics = service.getStatistics(admin);

        assertThat(statistics.getStatusCounts())
                .extracting(TicketStatusCount::getStatus, TicketStatusCount::getCount)
                .containsExactlyInAnyOrder(
                        tuple(TicketStatus.ACTIVE, 3),
                        tuple(TicketStatus.TECH_REQUIRED, 3));
    }

    @Test
    void theLegacyCountsAddUpToTheSameTotal() {
        givenBoard(
                status("st-ai", TicketStatusKind.AI_ASSISTANCE, 4),
                status("st-resolved", TicketStatusKind.RESOLVED, 5),
                status("st-archived", TicketStatusKind.ARCHIVED, 2));

        TicketStatistics statistics = service.getStatistics(admin);

        int legacyTotal = statistics.getStatusCounts().stream().mapToInt(TicketStatusCount::getCount).sum();
        assertThat(legacyTotal).isEqualTo(statistics.getTotalCount()).isEqualTo(11);
    }

    @Test
    void emptyBucketsAreNotReported() {
        givenBoard(status("st-ai", TicketStatusKind.AI_ASSISTANCE, 2));

        TicketStatistics statistics = service.getStatistics(admin);

        assertThat(statistics.getStatusCounts())
                .extracting(TicketStatusCount::getStatus)
                .containsExactly(TicketStatus.ACTIVE);
    }

    @Test
    void anEmptyBoardReportsNoLegacyCounts() {
        givenBoard();

        TicketStatistics statistics = service.getStatistics(admin);

        assertThat(statistics.getStatusCounts()).isEmpty();
        assertThat(statistics.getTotalCount()).isZero();
    }

    @Test
    void theLifecycleCountsAreStillReportedAsIs() {
        givenBoard(status("st-waiting", TicketStatusKind.CUSTOM, 2));

        TicketStatistics statistics = service.getStatistics(admin);

        assertThat(statistics.getStatusDefinitionCounts()).singleElement()
                .satisfies(c -> assertThat(c.getStatus().getId()).isEqualTo("st-waiting"));
    }

    private void givenBoard(StatusWithCount... statuses) {
        List<TicketStatusDefinition> definitions = Arrays.stream(statuses)
                .map(StatusWithCount::definition)
                .toList();
        when(ticketStatusService.list()).thenReturn(definitions);
        for (StatusWithCount s : statuses) {
            when(ticketRepository.countByStatusId(s.definition().getId())).thenReturn((long) s.count());
        }
    }

    private static StatusWithCount status(String id, TicketStatusKind kind, int count) {
        return new StatusWithCount(
                TicketStatusDefinition.builder().id(id).kind(kind).name(id).color("#fff").position("0|a:").build(),
                count);
    }

    private record StatusWithCount(TicketStatusDefinition definition, int count) {
    }
}
