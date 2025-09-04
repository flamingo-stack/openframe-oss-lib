package com.openframe.kafka.producer;

import org.springframework.kafka.core.KafkaTemplate;

public class KafkaProducer extends GenericKafkaProducer {

    public KafkaProducer(KafkaTemplate<String, Object> ossKafkaTemplate) {
        super(ossKafkaTemplate);
    }

}
