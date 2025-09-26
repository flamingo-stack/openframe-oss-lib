package com.openframe.kafka.producer.retry;

import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.springframework.stereotype.Service;

@Service
public class OssTenantRetryingKafkaProducer extends BaseRetryingKafkaProducer {

    public OssTenantRetryingKafkaProducer(OssTenantKafkaProducer producer, KafkaRecoveryHandler recoveryHandler) {
        super(producer, recoveryHandler);
    }
}
