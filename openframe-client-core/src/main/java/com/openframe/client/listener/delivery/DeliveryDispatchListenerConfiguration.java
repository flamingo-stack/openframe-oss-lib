package com.openframe.client.listener.delivery;

import com.openframe.audit.AuditRecorder;
import com.openframe.data.document.audit.AuditEntry;
import com.openframe.data.document.audit.AuditOutcome;
import com.openframe.delivery.metrics.DeliveryMetrics;
import com.openframe.kafka.config.KafkaJsonSerdes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.kafka.annotation.EnableKafka;
import org.springframework.kafka.config.ConcurrentKafkaListenerContainerFactory;
import org.springframework.kafka.core.ConsumerFactory;
import org.springframework.kafka.core.DefaultKafkaConsumerFactory;
import org.springframework.kafka.listener.ContainerProperties.AckMode;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.kafka.support.serializer.ErrorHandlingDeserializer;
import org.springframework.util.backoff.BackOff;
import org.springframework.util.backoff.FixedBackOff;

import java.util.HashMap;
import java.util.Map;

import static com.openframe.data.document.audit.AuditAction.DEVICE_DELIVERY_END;

// @EnableKafka travels with the @KafkaListener it enables: client-service scans no package that carries one, and a
// @KafkaListener without it is ignored without a word (seen on a feature tenant: no consumer thread, nothing consumed)
@Slf4j
@EnableKafka
@Configuration
@RequiredArgsConstructor
@ConditionalOnExpression("'${spring.oss-tenant.kafka.enabled:false}' == 'true' && '${openframe.delivery.dispatch-topic:}' != ''")
public class DeliveryDispatchListenerConfiguration {

    static final String CONTAINER_FACTORY = "deliveryDispatchListenerContainerFactory";
    static final String REJECTED_UNRECOVERABLE = "unrecoverable";
    static final BackOff MONGO_UNREACHABLE = new FixedBackOff(5_000L, FixedBackOff.UNLIMITED_ATTEMPTS);
    static final BackOff ANYTHING_ELSE = new FixedBackOff(1_000L, 10);

    private final DeliveryMetrics metrics;
    private final AuditRecorder auditRecorder;

    @Bean(CONTAINER_FACTORY)
    public ConcurrentKafkaListenerContainerFactory<Object, Object> deliveryDispatchListenerContainerFactory(
            @Qualifier("ossTenantKafkaConsumerFactory") ConsumerFactory<Object, Object> consumerFactory) {
        ConcurrentKafkaListenerContainerFactory<Object, Object> factory = new ConcurrentKafkaListenerContainerFactory<>();
        factory.setConsumerFactory(failingDeserializationAsError(consumerFactory));
        factory.getContainerProperties().setAckMode(AckMode.RECORD);
        factory.setCommonErrorHandler(errorHandler());
        return factory;
    }

    // a record the value deserializer cannot read (no type header, not JSON) fails inside poll(), before any listener or
    // error handler sees it: the container repeats that poll forever and the tenant's only partition is stuck behind the
    // record (seen on a feature tenant: ~2k error lines a second until the group offset was moved by hand); wrapped, the
    // failure reaches the error handler as a DeserializationException, which it gives up on at once. The delegate is the
    // shared factories' instance: named by class, Kafka builds a Jackson 2 deserializer that cannot read the Jackson 3 payload
    private static ConsumerFactory<Object, Object> failingDeserializationAsError(ConsumerFactory<Object, Object> shared) {
        Map<String, Object> properties = new HashMap<>(shared.getConfigurationProperties());
        ErrorHandlingDeserializer<Object> values = new ErrorHandlingDeserializer<>(KafkaJsonSerdes.valueDeserializer());
        return new DefaultKafkaConsumerFactory<>(properties, null, values);
    }

    // the record is acked only once the row is written: without Mongo it waits for Mongo; any other failure is a bug
    // of ours and must not hold the tenant's only partition, so that record is given up, counted and skipped
    private DefaultErrorHandler errorHandler() {
        DefaultErrorHandler handler = new DefaultErrorHandler(this::giveUp, ANYTHING_ELSE);
        handler.setBackOffFunction(this::backOffFor);
        return handler;
    }

    BackOff backOffFor(ConsumerRecord<?, ?> record, Exception failure) {
        return isMongoUnreachable(failure) ? MONGO_UNREACHABLE : ANYTHING_ELSE;
    }

    private boolean isMongoUnreachable(Exception failure) {
        return failure instanceof DataAccessResourceFailureException || failure instanceof TransientDataAccessException;
    }

    void giveUp(ConsumerRecord<?, ?> record, Exception failure) {
        metrics.recordDispatchRejected(REJECTED_UNRECOVERABLE);
        log.error("Delivery hand-off given up, record skipped: machineId={} topic={} offset={}",
                record.key(), record.topic(), record.offset(), failure);
        auditRecorder.record(AuditEntry.builder()
                .action(DEVICE_DELIVERY_END)
                .outcome(AuditOutcome.FAILURE)
                .reason(failure.getClass().getSimpleName())
                .details(Map.of("key", String.valueOf(record.key()), "topic", record.topic(), "offset", record.offset()))
                .build());
    }
}
