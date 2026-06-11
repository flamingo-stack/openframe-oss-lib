package com.openframe.kafka.producer.retry;

import java.util.Map;

public interface KafkaRecoveryHandler {

    void enqueue(Throwable ex, String topic, String key, Object payload);

    void enqueue(Throwable ex, String topic, String key, Object payload, Map<String, Object> headers);

}
