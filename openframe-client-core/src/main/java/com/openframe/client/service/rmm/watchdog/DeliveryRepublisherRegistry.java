package com.openframe.client.service.rmm.watchdog;

import com.openframe.data.document.rmm.script.DeliveryChannel;
import org.springframework.stereotype.Component;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Component
public class DeliveryRepublisherRegistry {

    private final Map<DeliveryChannel, DeliveryRepublisher> byChannel;

    public DeliveryRepublisherRegistry(List<DeliveryRepublisher> republishers) {
        Map<DeliveryChannel, DeliveryRepublisher> map = new EnumMap<>(DeliveryChannel.class);
        for (DeliveryRepublisher republisher : republishers) {
            DeliveryRepublisher previous = map.putIfAbsent(republisher.channel(), republisher);
            if (previous != null) {
                throw new IllegalStateException("Duplicate DeliveryRepublisher for " + republisher.channel()
                        + ": " + previous.getClass().getName() + " and " + republisher.getClass().getName());
            }
        }
        this.byChannel = map;
    }

    public DeliveryRepublisher get(DeliveryChannel channel) {
        DeliveryRepublisher republisher = byChannel.get(channel);
        if (republisher == null) {
            throw new IllegalStateException("No DeliveryRepublisher for channel " + channel);
        }
        return republisher;
    }
}
