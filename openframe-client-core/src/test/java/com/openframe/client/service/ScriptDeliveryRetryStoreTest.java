package com.openframe.client.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore;
import com.openframe.client.service.rmm.ScriptDeliveryRetryStore.RetryState;
import com.openframe.data.document.rmm.script.DeliveryChannel;
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
    @DisplayName("store: upserts {id, retryCount=0, channel, messageJson} under (executionId, machineId) with an expiresAt ~ now + TTL")
    void store_writesInitialStateWithTtl() {
        Instant approxNow = Instant.now();
        ScriptScheduleExecutionMessage msg = ScriptScheduleExecutionMessage.builder().executionId("e-1").machineId("m-1").build();

        store.store("e-1", "m-1", DeliveryChannel.SCHEDULE, msg);

        ArgumentCaptor<ScriptDeliveryRetry> captor = ArgumentCaptor.forClass(ScriptDeliveryRetry.class);
        verify(repository).save(captor.capture());
        ScriptDeliveryRetry saved = captor.getValue();
        assertThat(saved.getId()).isEqualTo(ID);
        assertThat(saved.getExecutionId()).isEqualTo("e-1");
        assertThat(saved.getMachineId()).isEqualTo("m-1");
        assertThat(saved.getRetryCount()).isZero();
        assertThat(saved.getChannel()).isEqualTo(DeliveryChannel.SCHEDULE);
        assertThat(saved.getMessageJson()).contains("\"executionId\":\"e-1\"");
        assertThat(saved.getExpiresAt()).isBetween(approxNow.plusSeconds(3595), approxNow.plusSeconds(3605));
    }

    @Test
    @DisplayName("get: returns retryCount + channel + raw messageJson (deserialization is the republisher's job)")
    void get_returnsState() {
        when(repository.findById(ID)).thenReturn(Optional.of(row(2, DeliveryChannel.SOFTWARE, "{\"x\":1}")));

        Optional<RetryState> got = store.get("e-1", "m-1");

        assertThat(got).isPresent();
        assertThat(got.get().retryCount()).isEqualTo(2);
        assertThat(got.get().channel()).isEqualTo(DeliveryChannel.SOFTWARE);
        assertThat(got.get().messageJson()).isEqualTo("{\"x\":1}");
    }

    @Test
    @DisplayName("get: a document written before software delivery-retry (null channel) defaults to SCHEDULE")
    void get_nullChannel_defaultsToSchedule() {
        when(repository.findById(ID)).thenReturn(Optional.of(row(0, null, "{}")));

        assertThat(store.get("e-1", "m-1")).get()
                .extracting(RetryState::channel).isEqualTo(DeliveryChannel.SCHEDULE);
    }

    @Test
    @DisplayName("get: missing document → empty")
    void get_missing_returnsEmpty() {
        when(repository.findById(ID)).thenReturn(Optional.empty());

        assertThat(store.get("e-1", "m-1")).isEmpty();
    }

    @Test
    @DisplayName("incrementRetryCount: upserts retryCount+1 keeping the channel + messageJson, and returns the new count")
    void increment_bumpsAndReturns() {
        RetryState current = new RetryState(1, DeliveryChannel.SOFTWARE, "{\"executionId\":\"e-1\"}");

        int next = store.incrementRetryCount("e-1", "m-1", current);

        assertThat(next).isEqualTo(2);
        ArgumentCaptor<ScriptDeliveryRetry> captor = ArgumentCaptor.forClass(ScriptDeliveryRetry.class);
        verify(repository).save(captor.capture());
        assertThat(captor.getValue().getId()).isEqualTo(ID);
        assertThat(captor.getValue().getRetryCount()).isEqualTo(2);
        assertThat(captor.getValue().getChannel()).isEqualTo(DeliveryChannel.SOFTWARE);
        assertThat(captor.getValue().getMessageJson()).isEqualTo("{\"executionId\":\"e-1\"}");
    }

    @Test
    @DisplayName("evict: deletes the (executionId, machineId) document by id")
    void evict_deletesKey() {
        store.evict("e-1", "m-1");
        verify(repository).deleteById(ID);
    }

    private static ScriptDeliveryRetry row(int retryCount, DeliveryChannel channel, String messageJson) {
        return ScriptDeliveryRetry.builder()
                .id(ID).executionId("e-1").machineId("m-1")
                .retryCount(retryCount).channel(channel).messageJson(messageJson)
                .expiresAt(Instant.now().plusSeconds(3600))
                .build();
    }
}
