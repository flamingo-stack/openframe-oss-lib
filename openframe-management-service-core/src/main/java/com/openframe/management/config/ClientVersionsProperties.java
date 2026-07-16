package com.openframe.management.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.client-versions")
public class ClientVersionsProperties {

    private String client;
    private String mesh;
    private String fleet;
    private String osquery;
}
