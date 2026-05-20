package com.openframe.data.nats.integration.support;

import com.openframe.data.config.NotificationContextJacksonConfig;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.autoconfigure.jackson.JacksonAutoConfiguration;
import org.springframework.context.annotation.Import;

@SpringBootConfiguration
@ImportAutoConfiguration({
        JacksonAutoConfiguration.class
})
@Import({
        NotificationContextJacksonConfig.class
})
public class PublisherIntegrationTestApplication {
}
