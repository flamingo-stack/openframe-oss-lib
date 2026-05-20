package com.openframe.stream.handler;

import com.openframe.stream.model.fleet.debezium.DeserializedDebeziumMessage;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnMissingBean(DebeziumEventValidator.class)
public class PassThroughDebeziumEventValidator implements DebeziumEventValidator {

    @Override
    public boolean isValid(DeserializedDebeziumMessage message) {
        return true;
    }
}
