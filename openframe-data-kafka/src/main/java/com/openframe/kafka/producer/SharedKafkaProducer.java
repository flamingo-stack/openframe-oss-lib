package com.openframe.kafka.producer;

import org.springframework.kafka.core.KafkaTemplate;

public class SharedKafkaProducer extends GenericKafkaProducer {

    public SharedKafkaProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        super(kafkaTemplate);
    }

}
