package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.api.dto.ticket.TicketStatusCount;
import com.openframe.data.document.ticket.TicketStatus;
import com.openframe.api.dto.ticket.TicketStatusDefinitionCount;
import com.openframe.api.service.ticket.spi.TicketRatingProvider;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class TicketStatisticsService {

    private static final String DEFAULT_TIME_FORMAT = "00:00:00";

    private final TicketRepository ticketRepository;
    private final TicketStatusService ticketStatusService;
    private final ObjectProvider<TicketRatingProvider> ratingProvider;

    public TicketStatistics getStatistics(AuthPrincipal principal) {
        validateAdminAccess(principal);
        log.debug("Fetching ticket statistics");

        List<TicketStatusDefinitionCount> statusDefinitionCounts = countByStatusDefinition();
        long totalCount = statusDefinitionCounts.stream().mapToInt(TicketStatusDefinitionCount::getCount).sum();

        Optional<Long> avgResolutionMs = ticketRepository.getAverageResolutionTimeMs();
        String formattedTime = avgResolutionMs
                .map(this::formatResolutionTime)
                .orElse(DEFAULT_TIME_FORMAT);

        Double averageRating = Optional.ofNullable(ratingProvider.getIfAvailable())
                .flatMap(TicketRatingProvider::averageRating)
                .orElse(0.0);

        return TicketStatistics.builder()
                .totalCount((int) totalCount)
                .statusCounts(foldToLegacyCounts(statusDefinitionCounts))
                .statusDefinitionCounts(statusDefinitionCounts)
                .averageResolutionTimeFormatted(formattedTime)
                .averageRating(averageRating)
                .build();
    }


    /**
     * The same totals keyed by the legacy enum, for clients built before the lifecycle rollout —
     * the mobile and desktop shells ship a frozen web bundle. Custom columns have no legacy
     * counterpart, so they land in the bucket their kind maps to; empty buckets are left out, the
     * way the enum-era counts behaved.
     * TODO(lifecycle-rollout): drop once no released shell reads statusCounts.
     */
    private List<TicketStatusCount> foldToLegacyCounts(List<TicketStatusDefinitionCount> counts) {
        Map<TicketStatus, Integer> folded = new EnumMap<>(TicketStatus.class);
        for (TicketStatusDefinitionCount count : counts) {
            if (count.getCount() == null || count.getCount() == 0) {
                continue;
            }
            TicketStatus legacy = TicketStatus.fromKind(count.getStatus().getKind());
            folded.merge(legacy, count.getCount(), Integer::sum);
        }
        return folded.entrySet().stream()
                .map(e -> TicketStatusCount.builder().status(e.getKey()).count(e.getValue()).build())
                .toList();
    }

    private List<TicketStatusDefinitionCount> countByStatusDefinition() {
        return ticketStatusService.list().stream()
                .map(status -> TicketStatusDefinitionCount.builder()
                        .status(status)
                        .count((int) ticketRepository.countByStatusId(status.getId()))
                        .build())
                .toList();
    }

    private String formatResolutionTime(Long milliseconds) {
        if (milliseconds == null || milliseconds == 0) {
            return DEFAULT_TIME_FORMAT;
        }
        Duration duration = Duration.ofMillis(milliseconds);
        long hours = duration.toHours();
        long minutes = duration.toMinutesPart();
        long seconds = duration.toSecondsPart();
        return String.format("%02d:%02d:%02d", hours, minutes, seconds);
    }
}
