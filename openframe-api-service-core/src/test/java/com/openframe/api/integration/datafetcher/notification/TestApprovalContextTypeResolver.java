package com.openframe.api.integration.datafetcher.notification;

import com.openframe.api.datafetcher.notification.NotificationContextTypeResolver;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextBinding;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/** Test-only resolver + binding so {@link TestApprovalContext} round-trips through the full stack. */
@Component
@Order(0)
public class TestApprovalContextTypeResolver
        implements NotificationContextTypeResolver, NotificationContextBinding {

    public static final String TYPE = "TEST_APPROVAL_REQUEST";

    @Override
    public String resolveTypeName(NotificationContext source) {
        return source instanceof TestApprovalContext ? "TestApprovalContext" : null;
    }

    @Override
    public String type() {
        return TYPE;
    }

    @Override
    public Class<? extends NotificationContext> contextClass() {
        return TestApprovalContext.class;
    }
}
