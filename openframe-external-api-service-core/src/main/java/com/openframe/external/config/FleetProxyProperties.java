package com.openframe.external.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.fleet.multi-tenancy")
public class FleetProxyProperties {

    private boolean enabled = false;

    private List<String> allowedEndpoints = new ArrayList<>();
}
