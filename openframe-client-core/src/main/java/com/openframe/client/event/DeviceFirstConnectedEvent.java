package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

// Published once, when a device is promoted PENDING -> MANAGED; the SaaS layer turns it into DEVICE_REGISTERED.
@Getter
public class DeviceFirstConnectedEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceFirstConnectedEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
