package com.openframe.client.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.isEmpty;

@Component
@Slf4j
public class NatsTopicUserIdExtractor {

    public String extract(String subject) {
        if (isEmpty(subject)) {
            throw new IllegalArgumentException("NATS subject cannot be empty");
        }

        String[] parts = subject.split("\\.");
        if (parts.length < 3 || !"user".equals(parts[0])) {
            throw new IllegalArgumentException(
                String.format("Invalid NATS subject format. Expected: user.{userId}.{suffix}, got: %s", subject)
            );
        }

        String userId = parts[1];
        if (isEmpty(userId)) {
            throw new IllegalArgumentException("User ID is empty in subject: " + subject);
        }

        log.debug("Extracted userId '{}' from subject '{}'", userId, subject);
        return userId;
    }
}
