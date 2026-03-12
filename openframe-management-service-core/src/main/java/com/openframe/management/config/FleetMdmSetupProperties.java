package com.openframe.management.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.fleet-mdm.setup")
public class FleetMdmSetupProperties {

    private String adminName;
    private String orgName;

}
