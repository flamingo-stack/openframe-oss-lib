package com.openframe.management.config;

import com.openframe.data.document.clientconfiguration.ClientFeatureFlag;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.LinkedHashMap;
import java.util.Map;

// the switches every client of the environment runs with; a release changes them here, management rolls them out
@Data
@Component
@ConfigurationProperties(prefix = "openframe.client")
public class ClientFeatureFlagsProperties {

    private Map<String, ClientFeatureFlag> featureFlags = new LinkedHashMap<>();
}
