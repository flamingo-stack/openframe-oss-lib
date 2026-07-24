package com.openframe.client.event;

import com.openframe.data.document.device.Machine;
import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class DeviceCameOnlineEvent extends ApplicationEvent {

    private final Machine machine;

    public DeviceCameOnlineEvent(Object source, Machine machine) {
        super(source);
        this.machine = machine;
    }
}
