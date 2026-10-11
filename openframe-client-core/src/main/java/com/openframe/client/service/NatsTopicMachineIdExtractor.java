package com.openframe.client.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

import static org.apache.commons.lang3.StringUtils.isEmpty;

@Component
@Slf4j
public class NatsTopicMachineIdExtractor {

    private static final Pattern MACHINE_ID_PATTERN =
        Pattern.compile("^[a-zA-Z0-9-]+$");

    public String extract(String subject) {
        if (isEmpty(subject)) {
            throw new IllegalArgumentException("NATS subject cannot be empty");
        }
        
        String[] parts = subject.split("\\.");
        if (parts.length < 3 || !"machine".equals(parts[0])) {
            throw new IllegalArgumentException(
                String.format("Invalid NATS subject format. Expected: machine.{machineId}.{suffix}, got: %s", subject)
            );
        }
        
        String machineId = parts[1];
        if (isEmpty(machineId)) {
            throw new IllegalArgumentException("Machine ID is empty in subject: " + subject);
        }
        if (!MACHINE_ID_PATTERN.matcher(machineId).matches()) {
            throw new IllegalArgumentException("Machine ID has invalid format in subject: " + subject);
        }
        
        log.debug("Extracted machineId '{}' from subject '{}'", machineId, subject);
        return machineId;
    }
}

