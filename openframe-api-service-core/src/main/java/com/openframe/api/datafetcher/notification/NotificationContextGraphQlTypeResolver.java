package com.openframe.api.datafetcher.notification;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsTypeResolver;

// Notification.context is always null, so this never runs; DGS still needs a resolver to wire the interface.
@DgsComponent
public class NotificationContextGraphQlTypeResolver {

    static final String GENERIC_TYPE = "GenericContext";

    @DgsTypeResolver(name = "NotificationContext")
    public String resolveType(Object context) {
        return GENERIC_TYPE;
    }
}
