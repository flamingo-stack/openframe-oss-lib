package com.openframe.data.pinot.config;

import lombok.extern.slf4j.Slf4j;
import org.apache.pinot.client.Connection;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;

@Slf4j
@Configuration
@ConditionalOnProperty(name = "pinot.broker.warmup.enabled", havingValue = "true")
public class PinotBrokerWarmup {

    private final Connection pinotConnection;

    @Value("${pinot.tables.devices.name}")
    private String devicesTableName;

    public PinotBrokerWarmup(@Qualifier("pinotBrokerConnection") Connection pinotConnection) {
        this.pinotConnection = pinotConnection;
    }

    @EventListener(ApplicationReadyEvent.class)
    public void warmUp() {
        try {
            log.info("Pinot broker warm-up");
            pinotConnection.execute("SELECT COUNT(*) FROM \"" + devicesTableName + "\" LIMIT 1");
            log.info("Pinot broker warm-up query executed successfully");
        } catch (Exception e) {
            log.warn("Pinot broker warm-up failed (non-blocking): {}", e.getMessage());
        }
    }
}
