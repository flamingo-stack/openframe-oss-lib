package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.mapper.LogDetailsMapper;
import com.openframe.data.loki.client.LokiQueryException;
import com.openframe.data.loki.toolevent.LokiLogEvent;
import com.openframe.data.loki.toolevent.LokiLogEventRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.springframework.boot.test.system.CapturedOutput;
import org.springframework.boot.test.system.OutputCaptureExtension;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith({MockitoExtension.class, OutputCaptureExtension.class})
class LokiLogDetailsServiceTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock
    private LokiLogEventRepository lokiLogEventRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Mock
    private LogDetailsMapper logDetailsMapper;

    @InjectMocks
    private LokiLogDetailsService service;

    @Test
    void findLogDetails_eventStoredForTheCallersTenant_returnsItMapped() {
        LokiLogEvent stored = LokiLogEvent.builder().toolEventId("evt-1").build();
        LogDetails mapped = LogDetails.builder().id("1790848800123_evt-1").build();
        whenLookedUpForTheCallersTenant().thenReturn(Optional.of(stored));
        when(logDetailsMapper.toLogDetails(stored)).thenReturn(mapped);

        Optional<LogDetails> details = findLogDetails();

        assertThat(details).containsSame(mapped);
    }

    @Test
    void findLogDetails_nothingStored_warnsWithTheEventAndReturnsEmpty(CapturedOutput output) {
        whenLookedUpForTheCallersTenant().thenReturn(Optional.empty());

        Optional<LogDetails> details = findLogDetails();

        assertThat(details).isEmpty();
        assertThat(output.getOut()).contains("Tool event not found in Loki: tenantId=tenant-a, toolType=FLEET, "
                + "timestamp=2026-10-01T10:00:00.123Z, toolEventId=evt-1");
    }

    @Test
    void findLogDetails_lokiFails_letsTheQueryFailureThrough() {
        LokiQueryException failure = new LokiQueryException("Loki query failed: connection refused");
        whenLookedUpForTheCallersTenant().thenThrow(failure);

        assertThatThrownBy(this::findLogDetails).isSameAs(failure);
    }

    private Optional<LogDetails> findLogDetails() {
        return service.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");
    }

    private OngoingStubbing<Optional<LokiLogEvent>> whenLookedUpForTheCallersTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        return when(lokiLogEventRepository.find("tenant-a", "FLEET", TIMESTAMP, "evt-1"));
    }
}
