package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BothStoresLogDetailsServiceTest {

    private static final Instant LOKI_SINCE = Instant.parse("2026-10-21T00:00:00Z");

    @Mock
    private CassandraLogDetailsService cassandraLogDetailsService;

    @Mock
    private LokiLogDetailsService lokiLogDetailsService;

    @Test
    void findLogDetails_eventAtTheStartDate_readsLoki() {
        LogDetails details = LogDetails.builder().toolEventId("evt-1").build();
        when(lokiLogDetailsService.findLogDetails("2026-10-21", "FLEET", "UNKNOWN", LOKI_SINCE, "evt-1"))
                .thenReturn(Optional.of(details));

        Optional<LogDetails> found = service().findLogDetails("2026-10-21", "FLEET", "UNKNOWN", LOKI_SINCE, "evt-1");

        assertThat(found).containsSame(details);
        verifyNoInteractions(cassandraLogDetailsService);
    }

    @Test
    void findLogDetails_eventJustBeforeTheStartDate_readsCassandra() {
        Instant justBefore = LOKI_SINCE.minusMillis(1);
        LogDetails details = LogDetails.builder().toolEventId("evt-1").build();
        when(cassandraLogDetailsService.findLogDetails("2026-10-20", "FLEET", "UNKNOWN", justBefore, "evt-1"))
                .thenReturn(Optional.of(details));

        Optional<LogDetails> found = service().findLogDetails("2026-10-20", "FLEET", "UNKNOWN", justBefore, "evt-1");

        assertThat(found).containsSame(details);
        verifyNoInteractions(lokiLogDetailsService);
    }

    private BothStoresLogDetailsService service() {
        return new BothStoresLogDetailsService(cassandraLogDetailsService, lokiLogDetailsService, LOKI_SINCE);
    }
}
