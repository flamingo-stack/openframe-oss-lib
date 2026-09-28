package com.openframe.data.nats.delivery;

import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.delivery.dispatch.DeliveryPublisher;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@ConditionalOnProperty("spring.cloud.stream.enabled")
public class NatsDeliveryPublisher implements DeliveryPublisher {

    private final NatsMessagePublisher natsMessagePublisher;

    @Override
    public void publish(String subject, Object payload) {
        natsMessagePublisher.publish(subject, payload);
    }
}
