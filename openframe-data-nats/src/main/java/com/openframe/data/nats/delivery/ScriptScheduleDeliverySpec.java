package com.openframe.data.nats.delivery;

import com.openframe.core.crypto.service.EncryptionContext;
import com.openframe.core.crypto.service.EncryptionService;
import com.openframe.data.document.delivery.DeliveryType;
import com.openframe.data.nats.rmm.model.ScriptScheduleExecutionMessage;
import com.openframe.delivery.spec.DeliveryRequest;
import com.openframe.data.service.TenantIdProvider;
import com.openframe.delivery.spec.DeliverySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static com.openframe.core.crypto.service.SecretPurpose.SCRIPT_ENV_VAR;
import static java.lang.String.format;

@Component
@ConditionalOnProperty("spring.cloud.stream.enabled")
@RequiredArgsConstructor
public class ScriptScheduleDeliverySpec implements DeliverySpec<ScriptScheduleDeliverySeed, ScriptScheduleExecutionMessage> {

    // the subject every agent since the schedule listener subscribes to over core NATS, no stream behind it: the
    // engine and the path without it send the same message there, the agent answers both on execution.acknowledge
    private static final String SUBJECT_TEMPLATE = "machine.%s.script-schedule-execution";

    // ObjectProvider: a service that never sends this type boots without the encryption config
    private final ObjectProvider<EncryptionService> encryptionService;
    private final TenantIdProvider tenantIdProvider;

    @Override
    public DeliveryType getType() {
        return DeliveryType.SCRIPT_SCHEDULE;
    }

    @Override
    public Class<ScriptScheduleExecutionMessage> getPayloadClass() {
        return ScriptScheduleExecutionMessage.class;
    }

    @Override
    public DeliveryRequest<ScriptScheduleExecutionMessage> request(ScriptScheduleDeliverySeed seed) {
        return DeliveryRequest.<ScriptScheduleExecutionMessage>builder()
                .type(DeliveryType.SCRIPT_SCHEDULE)
                .targetId(seed.getTargetId())
                .machineId(seed.getMachineId())
                .payload(seed.getMessage())
                .offlineBehavior(seed.getOfflineBehavior())
                .reconnectWindowSeconds(seed.getReconnectWindowSeconds())
                .build();
    }

    // the batch is stored with its secrets encrypted, the agent gets them in the clear
    @Override
    public ScriptScheduleExecutionMessage wireForm(ScriptScheduleExecutionMessage message) {
        EncryptionContext context = EncryptionContext.forTenant(tenantIdProvider.getTenantId(), SCRIPT_ENV_VAR);
        return message.revealed(value -> encryptionService.getObject().decrypt(value, context));
    }

    @Override
    public String subject(String machineId) {
        return format(SUBJECT_TEMPLATE, machineId);
    }
}
