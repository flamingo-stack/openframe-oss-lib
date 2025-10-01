package com.openframe.kafka.producer.retry;

public interface KafkaRecoveryHandler {

    void enqueue(Throwable ex, String topic, String key, Object payload);

}
