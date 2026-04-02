package com.openframe.featureflags;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.LinkedHashMap;
import java.util.Map;

@Data
@ConfigurationProperties(prefix = "openframe")
public class FeFeatureFlagProperties {

    private Map<String, Boolean> feFeatureFlag = new LinkedHashMap<>();
}
