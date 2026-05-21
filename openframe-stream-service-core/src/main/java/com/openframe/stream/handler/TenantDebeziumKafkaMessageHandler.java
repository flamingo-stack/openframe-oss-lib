package com.openframe.stream.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.openframe.kafka.producer.retry.OssTenantRetryingKafkaProducer;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@ConditionalOnBean(OssTenantRetryingKafkaProducer.class)
public class TenantDebeziumKafkaMessageHandler extends DebeziumKafkaMessageHandler {

    @Value("${openframe.oss-tenant.kafka.topics.outbound.integrated-tool-events}")
    private String topic;

    public TenantDebeziumKafkaMessageHandler(OssTenantRetryingKafkaProducer kafkaProducer,
                                             ObjectMapper objectMapper,
                                             DebeziumEventValidator validator) {
        super(kafkaProducer, objectMapper, validator);
    }

    @Override
    protected String getTopic() {
        return topic;
    }
}
