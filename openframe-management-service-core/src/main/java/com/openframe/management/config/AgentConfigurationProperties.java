package com.openframe.management.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.management")
public class AgentConfigurationProperties {
    
    private List<String> agentConfigurations = new ArrayList<>();

    private Map<String, Map<String, String>> agentMinOsVersions = new HashMap<>();
}

