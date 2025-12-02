package com.openframe.management.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.management")
public class AgentConfigurationProperties {
    
    private List<String> agentConfigurations = new ArrayList<>();
}

