package com.openframe.stream.deserializer;

import com.openframe.data.model.enums.MessageType;
import org.springframework.stereotype.Component;

@Component
public class FleetHostSoftwareDeserializer extends FleetProjectionEventDeserializer {

    @Override
    public MessageType getType() {
        return MessageType.FLEET_MDM_HOST_SOFTWARE_EVENT;
    }
}
