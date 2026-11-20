package com.openframe.kafka.listener;

import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.springframework.util.backoff.BackOff;

// How long a Kafka consumer waits before it retries a failed record; STOP sends it to the dead-letter topic.
@FunctionalInterface
public interface ConsumerRetryPolicy {

    BackOff backOffFor(ConsumerRecord<?, ?> record, Exception failure);
}
