package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.mapper.LogDetailsMapper;
import com.openframe.data.loki.toolevent.LokiLogEventRepository;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@Slf4j
@RequiredArgsConstructor
@ConditionalOnExpression("'${openframe.tool-events.store:}' matches '(?i)loki|both'")
public class LokiLogDetailsService implements LogDetailsService {

    private final LokiLogEventRepository lokiLogEventRepository;
    private final TenantIdProvider tenantIdProvider;
    private final LogDetailsMapper logDetailsMapper;

    @Override
    public Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                               String toolEventId) {
        log.debug("Finding log details for toolType: {}, timestamp: {}, toolEventId: {}",
                toolType, timestamp, toolEventId);

        String tenantId = tenantIdProvider.getTenantId();
        Optional<LogDetails> details = lokiLogEventRepository
                .find(tenantId, toolType, timestamp, toolEventId)
                .map(logDetailsMapper::toLogDetails);
        if (details.isPresent()) {
            log.debug("Log details found");
        } else {
            log.warn("Tool event not found in Loki: tenantId={}, toolType={}, timestamp={}, toolEventId={}",
                    tenantId, toolType, timestamp, toolEventId);
        }
        return details;
    }
}
