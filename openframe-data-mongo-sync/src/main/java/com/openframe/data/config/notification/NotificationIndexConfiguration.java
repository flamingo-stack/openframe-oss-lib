package com.openframe.data.config.notification;

import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.event.EventListener;
import org.springframework.data.mongodb.core.MongoTemplate;

@Configuration
public class NotificationIndexConfiguration {

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady(ApplicationReadyEvent event) {
        MongoTemplate mongoTemplate = event.getApplicationContext().getBean(MongoTemplate.class);
        NotificationIndexes.ensure(mongoTemplate);
    }
}
