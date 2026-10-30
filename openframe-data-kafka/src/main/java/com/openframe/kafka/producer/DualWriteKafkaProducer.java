package com.openframe.kafka.producer;

import com.openframe.kafka.model.KafkaMessage;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.NestedExceptionUtils;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.core.ProducerFactory;
import org.springframework.kafka.support.SendResult;

import java.util.Map;
import java.util.concurrent.CompletableFuture;

@Slf4j
public class DualWriteKafkaProducer implements MessageProducer {

    private final OssTenantKafkaProducer primary;
    private final KafkaTemplate<String, Object> secondary;

    public DualWriteKafkaProducer(ProducerFactory<String, Object> primaryProducerFactory, ProducerFactory<String, Object> secondaryProducerFactory) {
        this.primary = new OssTenantKafkaProducer(new KafkaTemplate<>(primaryProducerFactory));
        this.secondary = new KafkaTemplate<>(secondaryProducerFactory);
        this.secondary.setProducerListener(null);
    }

    @Override
    public CompletableFuture<SendResult<String, Object>> sendAsyncMessage(String topic, KafkaMessage message, String key) {
        throw new UnsupportedOperationException("Not supported by the dual write");
    }

    @Override
    public void sendAndAwaitMessage(String topic, KafkaMessage message, String key) {
        primary.sendAndAwaitMessage(topic, message, key);
        try {
            secondary.send(topic, key, message).whenComplete((_, failure) -> {
                if (failure != null) {
                    logFailure(topic, key, failure);
                }
            });
        } catch (RuntimeException e) {
            logFailure(topic, key, e);
        }
    }

    @Override
    public void sendAndAwaitMessage(String topic, KafkaMessage message, String key, Map<String, Object> headers) {
        throw new UnsupportedOperationException("Not supported by the dual write");
    }

    public void close() {
        primary.getKafkaTemplate().getProducerFactory().reset();
        secondary.getProducerFactory().reset();
    }

    private void logFailure(String topic, String key, Throwable failure) {
        String reason = NestedExceptionUtils.getMostSpecificCause(failure).getMessage();
        log.error("Write to secondary cluster failed: cluster={} topic={} key={} error={}",
                secondary.getProducerFactory().getConfigurationProperties().get("bootstrap.servers"), topic, key, reason);
    }
}
