package com.openframe.data.service.machine;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

// Off by default: MachineWriter then publishes no status write, as before MachineEvent carried the status.
@Data
@ConfigurationProperties(prefix = "openframe.events.machines.publish-lifecycle-status")
public class MachineLifecycleStatusPublishingProperties {

    private boolean enabled;
}
