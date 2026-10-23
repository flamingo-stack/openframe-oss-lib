package com.openframe.stream.listener;

import com.openframe.data.repository.redis.MachineIdCacheService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.connection.DefaultMessage;

import java.nio.charset.StandardCharsets;

import static com.openframe.data.repository.redis.MachineIdCacheService.INVALIDATION_CHANNEL;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class MachineCacheInvalidationListenerTest {

    private static final String MACHINE_ID = "6d925893-702a-4223-b62f-2f80b927cbaa";

    @Mock
    private MachineIdCacheService machineIdCacheService;

    @InjectMocks
    private MachineCacheInvalidationListener listener;

    @Test
    @DisplayName("onMessage: decodes the machineId from the channel payload and evicts its cached info")
    void onMessage_evictsMachineFromPayload() {
        byte[] channel = INVALIDATION_CHANNEL.getBytes(StandardCharsets.UTF_8);
        byte[] body = MACHINE_ID.getBytes(StandardCharsets.UTF_8);

        listener.onMessage(new DefaultMessage(channel, body), null);

        verify(machineIdCacheService).evictMachine(MACHINE_ID);
    }
}
