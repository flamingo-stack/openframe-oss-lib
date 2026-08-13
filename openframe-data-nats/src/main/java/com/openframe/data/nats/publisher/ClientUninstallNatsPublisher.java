package com.openframe.data.nats.publisher;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.util.Map;

import static java.lang.String.format;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
@Slf4j
public class ClientUninstallNatsPublisher {

    private final static String TOPIC_NAME_TEMPLATE = "machine.%s.client-uninstall";

    private final NatsMessagePublisher natsMessagePublisher;

    public void publish(String machineId) {
        String topicName = format(TOPIC_NAME_TEMPLATE, machineId);
        // the message itself is the command — no payload contract, empty JSON body
        natsMessagePublisher.publishPersistent(topicName, Map.of());

        log.info("Published client uninstall command for machine {}", machineId);
    }
}
