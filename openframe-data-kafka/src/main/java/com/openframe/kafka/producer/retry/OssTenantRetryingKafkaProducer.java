package com.openframe.kafka.producer.retry;

import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "spring.oss-tenant.kafka", name = "enabled", havingValue = "true")
public class OssTenantRetryingKafkaProducer extends BaseRetryingKafkaProducer {

    public OssTenantRetryingKafkaProducer(OssTenantKafkaProducer producer, KafkaRecoveryHandler recoveryHandler) {
        super(producer, recoveryHandler);
    }
}
