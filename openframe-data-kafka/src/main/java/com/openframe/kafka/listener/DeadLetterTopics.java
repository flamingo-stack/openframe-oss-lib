package com.openframe.kafka.listener;

// The dead-letter topic of a consumed topic: the same name with the suffix.
public final class DeadLetterTopics {

    public static final String SUFFIX = "-dlt";

    private DeadLetterTopics() {
    }

    public static String of(String topic) {
        return topic + SUFFIX;
    }
}
