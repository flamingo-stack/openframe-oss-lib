package com.openframe.client.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Duration;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScriptDeliveryRetryStoreTest {

    private static final String KEY = "rmm:script:retry:e-1:m-1";

    @Mock private RedisTemplate<String, String> redisTemplate;
    @Mock private ValueOperations<String, String> valueOps;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private ScriptDeliveryRetryStore store;

    @BeforeEach
    void setUp() {
        store = new ScriptDeliveryRetryStore(redisTemplate, objectMapper);
        ReflectionTestUtils.setField(store, "ttlSeconds", 3600L);
    }

    @Test
    @DisplayName("store: writes {retryCount=0, message} under (executionId, machineId) with the configured TTL")
    void store_writesInitialStateWithTtl() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().executionId("e-1").machineId("m-1").build();

        store.store("e-1", "m-1", msg);

        ArgumentCaptor<String> keyCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> valCap = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<Duration> ttlCap = ArgumentCaptor.forClass(Duration.class);
        verify(valueOps).set(keyCap.capture(), valCap.capture(), ttlCap.capture());
        assertThat(keyCap.getValue()).isEqualTo(KEY);
        assertThat(ttlCap.getValue()).isEqualTo(Duration.ofSeconds(3600));
        RetryState written = objectMapper.readValue(valCap.getValue(), RetryState.class);
        assertThat(written.retryCount()).isZero();
        assertThat(written.message().getExecutionId()).isEqualTo("e-1");
    }

    @Test
    @DisplayName("get: deserializes the stored retry state")
    void get_returnsDeserializedState() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        RetryState stored = new RetryState(2, ScriptScheduleExecutionMessage.builder().machineId("m-1").build());
        when(valueOps.get(KEY)).thenReturn(objectMapper.writeValueAsString(stored));

        Optional<RetryState> got = store.get("e-1", "m-1");

        assertThat(got).isPresent();
        assertThat(got.get().retryCount()).isEqualTo(2);
        assertThat(got.get().message().getMachineId()).isEqualTo("m-1");
    }

    @Test
    @DisplayName("get: missing key → empty")
    void get_missing_returnsEmpty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(KEY)).thenReturn(null);

        assertThat(store.get("e-1", "m-1")).isEmpty();
    }

    @Test
    @DisplayName("get: corrupt JSON → empty (no throw)")
    void get_corrupt_returnsEmpty() {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        when(valueOps.get(KEY)).thenReturn("{not-json");

        assertThat(store.get("e-1", "m-1")).isEmpty();
    }

    @Test
    @DisplayName("incrementRetryCount: writes retryCount+1 (keeping the message) and returns the new count")
    void increment_bumpsAndReturns() throws Exception {
        when(redisTemplate.opsForValue()).thenReturn(valueOps);
        RetryState current = new RetryState(1, ScriptScheduleExecutionMessage.builder().executionId("e-1").build());

        int next = store.incrementRetryCount("e-1", "m-1", current);

        assertThat(next).isEqualTo(2);
        ArgumentCaptor<String> valCap = ArgumentCaptor.forClass(String.class);
        verify(valueOps).set(eq(KEY), valCap.capture(), any(Duration.class));
        RetryState written = objectMapper.readValue(valCap.getValue(), RetryState.class);
        assertThat(written.retryCount()).isEqualTo(2);
        assertThat(written.message().getExecutionId()).isEqualTo("e-1");
    }

    @Test
    @DisplayName("evict: deletes the (executionId, machineId) key")
    void evict_deletesKey() {
        store.evict("e-1", "m-1");
        verify(redisTemplate).delete(KEY);
    }
}
