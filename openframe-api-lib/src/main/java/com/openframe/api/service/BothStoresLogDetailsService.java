package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;

@Service
@Primary
@RequiredArgsConstructor
@ConditionalOnProperty(name = "openframe.tool-events.store", havingValue = "both")
public class BothStoresLogDetailsService implements LogDetailsService {

    private final CassandraLogDetailsService cassandraLogDetailsService;
    private final LokiLogDetailsService lokiLogDetailsService;
    @Value("${openframe.tool-events.loki-since}")
    private final Instant lokiSince;

    @Override
    public Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                               String toolEventId) {
        LogDetailsService store = timestamp.isBefore(lokiSince) ? cassandraLogDetailsService : lokiLogDetailsService;
        return store.findLogDetails(ingestDay, toolType, eventType, timestamp, toolEventId);
    }
}
