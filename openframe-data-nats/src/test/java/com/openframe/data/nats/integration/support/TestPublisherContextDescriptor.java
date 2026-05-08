package com.openframe.data.nats.integration.support;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptor;
import org.springframework.stereotype.Component;

@Component
public class TestPublisherContextDescriptor implements NotificationContextDescriptor {

    @Override
    public String type() {
        return TestPublisherContext.TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestPublisherContext.class;
    }
}
