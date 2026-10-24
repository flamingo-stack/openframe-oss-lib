package com.openframe.processing.listener;

import org.springframework.kafka.config.KafkaListenerEndpoint;
import org.springframework.kafka.listener.MessageListener;
import org.springframework.kafka.listener.MessageListenerContainer;
import org.springframework.kafka.support.TopicPartitionOffset;
import org.springframework.kafka.support.converter.MessageConverter;

import java.util.Collection;
import java.util.List;
import java.util.regex.Pattern;

// One topic and one group, like an annotated @KafkaListener; the container comes from the processing container factory.
public class PublishedTypeEndpoint implements KafkaListenerEndpoint {

    private final String id;
    private final String groupId;
    private final String topic;
    private final MessageListener<String, byte[]> listener;

    public PublishedTypeEndpoint(String id, String groupId, String topic, MessageListener<String, byte[]> listener) {
        this.id = id;
        this.groupId = groupId;
        this.topic = topic;
        this.listener = listener;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public String getGroupId() {
        return groupId;
    }

    @Override
    public String getGroup() {
        return null;
    }

    @Override
    public Collection<String> getTopics() {
        return List.of(topic);
    }

    @Override
    public TopicPartitionOffset[] getTopicPartitionsToAssign() {
        return new TopicPartitionOffset[0];
    }

    @Override
    public Pattern getTopicPattern() {
        return null;
    }

    @Override
    public String getClientIdPrefix() {
        return null;
    }

    @Override
    public Integer getConcurrency() {
        return null;
    }

    @Override
    public Boolean getAutoStartup() {
        return null;
    }

    // The listener reads the bytes itself, so the factory's message converter is not used.
    @Override
    public void setupListenerContainer(MessageListenerContainer listenerContainer, MessageConverter messageConverter) {
        listenerContainer.setupMessageListener(listener);
    }

    @Override
    public boolean isSplitIterables() {
        return true;
    }

    @Override
    public String getAckMode() {
        return null;
    }
}
