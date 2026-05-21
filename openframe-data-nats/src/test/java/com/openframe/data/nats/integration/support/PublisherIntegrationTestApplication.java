package com.openframe.data.nats.integration.support;

import com.openframe.data.config.NotificationContextJacksonConfig;
import com.openframe.data.nats.publisher.NatsMessagePublisher;
import com.openframe.data.nats.publisher.NotificationNatsPublisher;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootConfiguration
@EnableAutoConfiguration
@Import({
        NotificationContextJacksonConfig.class,
        NatsMessagePublisher.class,
        NotificationNatsPublisher.class
})
public class PublisherIntegrationTestApplication {
}
