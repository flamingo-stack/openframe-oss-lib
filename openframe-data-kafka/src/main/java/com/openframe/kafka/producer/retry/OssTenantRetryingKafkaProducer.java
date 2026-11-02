package com.openframe.kafka.producer.retry;

import com.openframe.kafka.producer.DualWriteKafkaProducer;
import com.openframe.kafka.producer.OssTenantKafkaProducer;
import org.jspecify.annotations.Nullable;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.util.Objects;

@Service
@ConditionalOnProperty(prefix = "spring.oss-tenant.kafka", name = "enabled", havingValue = "true")
public class OssTenantRetryingKafkaProducer extends BaseRetryingKafkaProducer {

    public OssTenantRetryingKafkaProducer(OssTenantKafkaProducer ossTenantKafkaProducer,
                                          @Nullable DualWriteKafkaProducer dualWriteKafkaProducer,
                                          KafkaRecoveryHandler recoveryHandler) {
        super(Objects.requireNonNullElse(dualWriteKafkaProducer, ossTenantKafkaProducer), recoveryHandler);
    }
}
