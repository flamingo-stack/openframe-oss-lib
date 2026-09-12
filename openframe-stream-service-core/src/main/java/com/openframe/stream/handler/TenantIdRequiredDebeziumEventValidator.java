package com.openframe.stream.handler;

import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Primary;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Primary
@ConditionalOnProperty(name = "openframe.tenant-isolation.enabled", havingValue = "true")
public class TenantIdRequiredDebeziumEventValidator implements DebeziumEventValidator {

    @Override
    public boolean isValid(DeserializedDebeziumMessage message) {
        if (message.getTenantId() == null || message.getTenantId().isBlank()) {
            log.error("[DEBEZIUM] Event dropped — no tenantId resolved: toolEventId={}",
                    message.getToolEventId());
            return false;
        }
        return true;
    }
}
