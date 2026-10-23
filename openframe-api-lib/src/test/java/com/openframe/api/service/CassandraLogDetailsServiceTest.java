package com.openframe.api.service;

import com.openframe.api.dto.audit.LogDetails;
import com.openframe.api.mapper.LogDetailsMapper;
import com.openframe.data.cassandra.model.CassandraLogEvent;
import com.openframe.data.cassandra.repository.CassandraLogEventRepository;
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
    private CassandraLogEventRepository cassandraLogEventRepository;

    @Mock
    private TenantIdProvider tenantIdProvider;

    @Mock
    private LogDetailsMapper logDetailsMapper;

    @InjectMocks
    private CassandraLogDetailsService service;

    @Test
    void findLogDetails_rowStoredUnderTheFullKeyOfTheCallersTenant_returnsItMapped() {
        CassandraLogEvent stored = new CassandraLogEvent();
        stored.setKey(key());
        LogDetails mapped = LogDetails.builder().id("1790848800123_evt-1").build();
        whenLookedUpForTheCallersTenant().thenReturn(Optional.of(stored));
        when(logDetailsMapper.toLogDetails(stored)).thenReturn(mapped);

        Optional<LogDetails> details = findLogDetails();

        assertThat(details).containsSame(mapped);
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

    private OngoingStubbing<Optional<CassandraLogEvent>> whenLookedUpForTheCallersTenant() {
        when(tenantIdProvider.getTenantId()).thenReturn("tenant-a");
        return when(cassandraLogEventRepository.findById(key()));
    }

    private static CassandraLogEvent.CassandraLogEventKey key() {
        CassandraLogEvent.CassandraLogEventKey key = new CassandraLogEvent.CassandraLogEventKey();
        key.setIngestDay("2026-10-01");
        key.setToolType("FLEET");
        key.setTenantId("tenant-a");
        key.setEventType("LOGIN");
        key.setEventTimestamp(TIMESTAMP);
        key.setToolEventId("evt-1");
        return key;
    }
}
