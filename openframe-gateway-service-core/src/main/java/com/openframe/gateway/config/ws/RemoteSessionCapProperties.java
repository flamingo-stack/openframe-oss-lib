package com.openframe.gateway.config.ws;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Data
@Component
@ConfigurationProperties(prefix = "openframe.remote-access-approval.session")
public class RemoteSessionCapProperties {

    private long maxDurationSeconds = 14400;
}
