package com.openframe.api.service.ticket;

import com.openframe.api.dto.ticket.TicketStatistics;
import com.openframe.api.dto.ticket.TicketStatusCount;
import com.openframe.api.dto.ticket.TicketStatusDefinitionCount;
import com.openframe.api.service.ticket.spi.TicketRatingProvider;
import com.openframe.data.repository.ticket.TicketRepository;
import com.openframe.security.authentication.AuthPrincipal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.validation.annotation.Validated;

import java.time.Duration;
import java.util.List;
import java.util.Optional;

import static com.openframe.api.util.AuthPrincipalUtils.validateAdminAccess;

@Service
@Slf4j
@Validated
@RequiredArgsConstructor
@Transactional(readOnly = true)
@ConditionalOnProperty(name = TicketFeature.ENABLED, havingValue = "true")
public class TicketStatisticsService {

    private static final String DEFAULT_TIME_FORMAT = "00:00:00";

    private final TicketRepository ticketRepository;
    private final TicketStatusService ticketStatusService;
    private final ObjectProvider<TicketRatingProvider> ratingProvider;

    @Value("${" + TicketFeature.LIFECYCLE_ENABLED + ":false}")
    private boolean lifecycleEnabled;

    public TicketStatistics getStatistics(AuthPrincipal principal) {
        validateAdminAccess(principal);
        log.debug("Fetching ticket statistics");

        List<TicketStatusCount> statusCounts = List.of();
        List<TicketStatusDefinitionCount> statusDefinitionCounts = List.of();
        long totalCount;
        if (lifecycleEnabled) {
            statusDefinitionCounts = countByStatusDefinition();
            totalCount = statusDefinitionCounts.stream().mapToInt(TicketStatusDefinitionCount::getCount).sum();
        } else {
            statusCounts = countByLegacyStatus();
            totalCount = statusCounts.stream().mapToInt(TicketStatusCount::getCount).sum();
        }

        Optional<Long> avgResolutionMs = ticketRepository.getAverageResolutionTimeMs();
        String formattedTime = avgResolutionMs
                .map(this::formatResolutionTime)
                .orElse(DEFAULT_TIME_FORMAT);

        Double averageRating = Optional.ofNullable(ratingProvider.getIfAvailable())
                .flatMap(TicketRatingProvider::averageRating)
                .orElse(0.0);

        return TicketStatistics.builder()
                .totalCount((int) totalCount)
                .statusCounts(statusCounts)
                .statusDefinitionCounts(statusDefinitionCounts)
                .averageResolutionTimeFormatted(formattedTime)
                .averageRating(averageRating)
                .build();
    }

    private List<TicketStatusCount> countByLegacyStatus() {
        return ticketRepository.countTicketsByStatus().entrySet().stream()
                .map(entry -> TicketStatusCount.builder()
                        .status(entry.getKey())
                        .count(entry.getValue().intValue())
                        .build())
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
