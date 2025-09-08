package com.openframe.kafka.utils;

import com.openframe.kafka.enumeration.KafkaTopicDestination;

public class KafkaUtils {

    private static String TOPIC_PREFIX = "tenants";
    private static String TOPIC_PATTERN = "%s.%s.%s.%s";

    public static String createSaasTenantTopicName(String topicName, String tenantId, KafkaTopicDestination destination) {
        return TOPIC_PATTERN.formatted(TOPIC_PREFIX, tenantId, topicName, destination.getValue());
    }

}
