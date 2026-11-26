package com.openframe.management.config.pinot;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OssPinotTables {

    @Bean
    public PinotTableDefinition devicesPinotTable() {
        return new PinotTableDefinition("devices", "schema-devices.json", "table-config-devices.json");
    }

    @Bean
    public PinotTableDefinition logsPinotTable() {
        return new PinotTableDefinition("logs", "schema-logs.json", "table-config-logs-realtime.json");
    }
}
