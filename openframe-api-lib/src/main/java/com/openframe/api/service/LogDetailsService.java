package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;

import java.time.Instant;
import java.util.Optional;

public interface LogDetailsService {

    Optional<LogDetails> findLogDetails(String ingestDay, String toolType, String eventType, Instant timestamp,
                                        String toolEventId);
}
