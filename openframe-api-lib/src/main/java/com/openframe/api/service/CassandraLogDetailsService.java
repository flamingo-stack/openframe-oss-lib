package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.mapper.LogDetailsMapper;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.cassandra.repository.CassandraLogEventRepository;
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
@ConditionalOnExpression("'${openframe.tool-events.store:}' matches '(?i)cassandra|both'")
public class CassandraLogDetailsService implements LogDetailsService {

    private final CassandraLogEventRepository cassandraLogEventRepository;
    private final TenantIdProvider tenantIdProvider;
    private final LogDetailsMapper logDetailsMapper;

    @Override
    public Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                               String toolEventId) {
        log.debug("Finding log details for ingestDay: {}, toolType: {}, eventType: {}, timestamp: {}, toolEventId: {}",
                ingestDay, toolType, eventType, timestamp, toolEventId);

        CassandraLogEvent.CassandraLogEventKey key = new CassandraLogEvent.CassandraLogEventKey();
        key.setIngestDay(ingestDay);
        key.setToolType(toolType);
        key.setTenantId(tenantIdProvider.getTenantId());
        key.setEventType(eventType);
        key.setEventTimestamp(timestamp);
        key.setToolEventId(toolEventId);

        Optional<CassandraLogEvent> logEvent = cassandraLogEventRepository.findById(key);

        if (logEvent.isPresent()) {
            LogDetails details = logDetailsMapper.toLogDetails(logEvent.get());
            log.debug("Successfully retrieved audit details");
            return Optional.of(details);
        } else {
            log.debug("Log details not found");
            return Optional.empty();
        }
    }
}
