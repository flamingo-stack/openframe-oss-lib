package com.openframe.kafka.producer.retry;

import com.openframe.kafka.producer.MessageProducer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "spring.oss-tenant.kafka", name = "enabled", havingValue = "true")
public class OssTenantRetryingKafkaProducer extends BaseRetryingKafkaProducer {

    public OssTenantRetryingKafkaProducer(MessageProducer ossTenantKafkaProducer, KafkaRecoveryHandler recoveryHandler) {
        super(ossTenantKafkaProducer, recoveryHandler);
    }
}
