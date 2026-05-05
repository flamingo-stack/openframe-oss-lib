package com.openframe.data.nats.integration.support;

import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextBinding;
import org.springframework.stereotype.Component;

/** Test binding for {@link TestPublisherContext}. */
@Component
public class TestPublisherContextBinding implements NotificationContextBinding {

    @Override
    public String type() {
        return TestPublisherContext.TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestPublisherContext.class;
    }
}
