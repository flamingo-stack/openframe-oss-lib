package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.data.cassandra.model.UnifiedLogEvent;
import com.openframe.data.cassandra.repository.UnifiedLogEventRepository;
import com.openframe.data.service.TenantIdProvider;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.stubbing.OngoingStubbing;
import org.springframework.dao.DataAccessResourceFailureException;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CassandraLogDetailsServiceTest {

    private static final Instant TIMESTAMP = Instant.parse("2026-10-01T10:00:00.123Z");

    @Mock
    private UnifiedLogEventRepository unifiedLogEventRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @InjectMocks
    private CassandraLogDetailsService service;

    @Test
    void findLogDetails_rowStoredUnderTheFullKeyOfTheCallersTenant_mapsEveryFieldOfTheStoredRow() {
        UnifiedLogEvent stored = new UnifiedLogEvent();
        stored.setKey(key());
        stored.setSeverity("WARNING");
        stored.setMessage("User logged in");
        stored.setDetails("{\"ip\":\"10.0.0.1\"}");
        stored.setDebeziumMessage("{\"op\":\"c\"}");
        stored.setUserId("user-7");
        stored.setDeviceId("device-7");
        stored.setHostname("host-7");
        stored.setNickname("Reception iMac");
        stored.setExecutionSource("MANUAL");
        stored.setScriptCreationSource("AI_ASSISTANT");
        stored.setOrganizationId("org-7");
        stored.setOrganizationName("Acme");
        whenLookedUpForTheCallersTenant().thenReturn(Optional.of(stored));

        Optional<LogDetails> details = findLogDetails();

        assertThat(details).contains(LogDetails.builder()
                .id("1790848800123_evt-1")
                .toolEventId("evt-1")
                .eventType("LOGIN")
                .ingestDay("2026-10-01")
                .toolType("FLEET")
                .severity("WARNING")
                .userId("user-7")
                .deviceId("device-7")
                .hostname("host-7")
                .nickname("Reception iMac")
                .executionSource("MANUAL")
                .scriptCreationSource("AI_ASSISTANT")
                .organizationId("org-7")
                .organizationName("Acme")
                .summary("User logged in")
                .timestamp(TIMESTAMP)
                .message("User logged in")
                .details("{\"ip\":\"10.0.0.1\"}")
                .build());
    }

    @Test
    void findLogDetails_nothingStored_returnsEmpty() {
        whenLookedUpForTheCallersTenant().thenReturn(Optional.empty());

        Optional<LogDetails> details = findLogDetails();

        assertThat(details).isEmpty();
    }

    @Test
    void findLogDetails_cassandraFails_letsTheFailureThrough() {
        DataAccessResourceFailureException failure = new DataAccessResourceFailureException("Cassandra is down");
        whenLookedUpForTheCallersTenant().thenThrow(failure);

        assertThatThrownBy(this::findLogDetails).isSameAs(failure);
    }

    private Optional<LogDetails> findLogDetails() {
        return service.findLogDetails("2026-10-01", "FLEET", "LOGIN", TIMESTAMP, "evt-1");
    }

    private OngoingStubbing<Optional<UnifiedLogEvent>> whenLookedUpForTheCallersTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        return when(unifiedLogEventRepository.findById(key()));
    }

    private static UnifiedLogEvent.UnifiedLogEventKey key() {
        UnifiedLogEvent.UnifiedLogEventKey key = new UnifiedLogEvent.UnifiedLogEventKey();
        key.setIngestDay("2026-10-01");
        key.setToolType("FLEET");
        key.setTenantId("tenant-a");
        key.setEventType("LOGIN");
        key.setEventTimestamp(TIMESTAMP);
        key.setToolEventId("evt-1");
        return key;
    }
}
