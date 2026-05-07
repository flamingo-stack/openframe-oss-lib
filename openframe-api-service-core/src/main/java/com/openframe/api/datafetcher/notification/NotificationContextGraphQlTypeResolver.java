package com.openframe.api.datafetcher.notification;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsTypeResolver;
import com.openframe.data.document.notification.NotificationContext;
import lombok.RequiredArgsConstructor;

import java.util.List;

@DgsComponent
@RequiredArgsConstructor
public class NotificationContextGraphQlTypeResolver {

    static final String DEFAULT_TYPE = "GenericContext";

    private final List<NotificationContextTypeResolver> resolvers;

    @DgsTypeResolver(name = "NotificationContext")
    public String resolveType(NotificationContext source) {
        for (NotificationContextTypeResolver resolver : resolvers) {
            String typeName = resolver.resolveTypeName(source);
            if (typeName != null) {
                return typeName;
            }
        }
        return DEFAULT_TYPE;
    }
}
