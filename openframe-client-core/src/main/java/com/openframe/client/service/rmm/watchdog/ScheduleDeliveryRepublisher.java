package com.openframe.client.service.rmm.watchdog;

import tools.jackson.databind.ObjectMapper;
import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.rmm.script.DeliveryChannel;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.data.nats.rmm.publisher.ScriptScheduleNatsPublisher;
import com.openframe.data.service.TenantIdProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;

@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleDeliveryRepublisher implements DeliveryRepublisher {

    private final ObjectMapper objectMapper;
    private final ScriptScheduleNatsPublisher scriptScheduleNatsPublisher;
    private final EncryptionService encryptionService;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public DeliveryChannel channel() {
        return DeliveryChannel.SCHEDULE;
    }

    @Override
    public void republish(String machineId, String messageJson) {
        try {
            ScriptScheduleExecutionMessage message =
                    objectMapper.readValue(messageJson, ScriptScheduleExecutionMessage.class);
            EncryptionContext context = EncryptionContext.forTenant(tenantIdProvider.getTenantId(), SCRIPT_ENV_VAR);
            ScriptScheduleExecutionMessage revealed = message.revealed(value -> encryptionService.decrypt(value, context));
            scriptScheduleNatsPublisher.publish(machineId, revealed);
        } catch (Exception e) {
            log.warn("Failed to re-publish schedule delivery machineId={}: {}", machineId, e.getMessage());
        }
    }
}
