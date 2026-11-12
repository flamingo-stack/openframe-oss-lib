package com.openframe.data.service;

import org.springframework.stereotype.Component;

import java.time.Instant;

@Component
public class AuditClock {

    public Instant now() {
        return Instant.now();
    }
}
