package com.openframe.api.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

@Getter
public class DeviceNicknameUpdatedEvent extends ApplicationEvent {

    private final String machineId;

    public DeviceNicknameUpdatedEvent(Object source, String machineId) {
        super(source);
        this.machineId = machineId;
    }
}
