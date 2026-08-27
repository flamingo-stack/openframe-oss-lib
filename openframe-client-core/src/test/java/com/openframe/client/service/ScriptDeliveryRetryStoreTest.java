package com.openframe.client.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.data.document.rmm.script.ScriptDeliveryRetry;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.repository.rmm.ScriptDeliveryRetryRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDeliveryRetryStoreTest {

    private static final String ID = "e-1:m-1";

    @Mock private ScriptDeliveryRetryRepository repository;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ScriptDeliveryRetryStore store;

    @BeforeEach
    void setUp() {
        store = new ScriptDeliveryRetryStore(repository, objectMapper);
        ReflectionTestUtils.setField(store, "ttlSeconds", 3600L);
    }

    @Test
    @DisplayName("store: upserts {id, retryCount=0, messageJson} under (executionId, machineId) with an expiresAt ~ now + TTL")
    void store_writesInitialStateWithTtl() {
        Instant approxNow = Instant.now();
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().executionId("e-1").machineId("m-1").build();

        store.store("e-1", "m-1", msg);

        ArgumentCaptor<ScriptDeliveryRetry> captor = ArgumentCaptor.forClass(ScriptDeliveryRetry.class);
        verify(repository).save(captor.capture());
        ScriptDeliveryRetry saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(ID);
        assertThat(saved.getExecutionId()).isEqualTo("e-1");
        assertThat(saved.getMachineId()).isEqualTo("m-1");
        assertThat(saved.getRetryCount()).isZero();
        assertThat(saved.getExpiresAt()).isBetween(approxNow.plusSeconds(3595), approxNow.plusSeconds(3605));
        RetryState written = readState(saved);
        assertThat(written.retryCount()).isZero();
        assertThat(written.message().getExecutionId()).isEqualTo("e-1");
    }

    @Test
    @DisplayName("get: deserializes the stored retry state")
    void get_returnsDeserializedState() throws Exception {
        RetryState stored = new RetryState(2, ScriptScheduleExecutionMessage.builder().machineId("m-1").build());
        when(repository.findById(ID)).thenReturn(Optional.of(row(2, objectMapper.writeValueAsString(stored.message()))));

        Optional<RetryState> got = store.get("e-1", "m-1");

        assertThat(got).isPresent();
        assertThat(got.get().retryCount()).isEqualTo(2);
        assertThat(got.get().message().getMachineId()).isEqualTo("m-1");
    }

    @Test
    @DisplayName("get: missing document → empty")
    void get_missing_returnsEmpty() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThat(store.get("e-1", "m-1")).isEmpty();
    }

    @Test
    @DisplayName("get: corrupt JSON payload → empty (no throw)")
    void get_corrupt_returnsEmpty() {
        when(repository.findById(ID)).thenReturn(Optional.of(row(1, "{not-json")));

        assertThat(store.get("e-1", "m-1")).isEmpty();
    }

    @Test
    @DisplayName("incrementRetryCount: upserts retryCount+1 (keeping the message) and returns the new count")
    void increment_bumpsAndReturns() {
        RetryState current = new RetryState(1, ScriptScheduleExecutionMessage.builder().executionId("e-1").build());

        int next = store.incrementRetryCount("e-1", "m-1", current);

        assertThat(next).isEqualTo(2);
        ArgumentCaptor<ScriptDeliveryRetry> captor = ArgumentCaptor.forClass(ScriptDeliveryRetry.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(ID);
        RetryState written = readState(captor.getValue());
        assertThat(written.retryCount()).isEqualTo(2);
        assertThat(written.message().getExecutionId()).isEqualTo("e-1");
    }

    @Test
    @DisplayName("evict: deletes the (executionId, machineId) document by id")
    void evict_deletesKey() {
        store.evict("e-1", "m-1");
        verify(repository).deleteById(ID);
    }

    private static ScriptDeliveryRetry row(int retryCount, String messageJson) {
        return ScriptDeliveryRetry.builder()
                .id(ID).executionId("e-1").machineId("m-1")
                .retryCount(retryCount).messageJson(messageJson)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }

    private RetryState readState(ScriptDeliveryRetry saved) {
        try {
            ScriptScheduleExecutionMessage message =
                    objectMapper.readValue(saved.getMessageJson(), ScriptScheduleExecutionMessage.class);
            return new RetryState(saved.getRetryCount(), message);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
