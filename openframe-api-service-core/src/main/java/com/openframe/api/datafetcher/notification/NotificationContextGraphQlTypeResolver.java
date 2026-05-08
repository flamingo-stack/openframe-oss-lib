package com.openframe.api.datafetcher.notification;

import com.netflix.graphql.dgs.DgsComponent;
import com.netflix.graphql.dgs.DgsTypeResolver;
import com.openframe.data.document.notification.NotificationContext;
import com.openframe.data.document.notification.NotificationContextDescriptor;

import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@DgsComponent
public class NotificationContextGraphQlTypeResolver {

    static final String DEFAULT_TYPE = "GenericContext";

    private final Map<String, String> typeNamesByDiscriminator;

    public NotificationContextGraphQlTypeResolver(List<NotificationContextDescriptor> descriptors) {
        this.typeNamesByDiscriminator = descriptors.stream()
                .collect(Collectors.toUnmodifiableMap(
                        NotificationContextDescriptor::type,
                        NotificationContextDescriptor::graphqlTypeName,
                        (left, right) -> left));
    }

    @DgsTypeResolver(name = "NotificationContext")
    public String resolveType(NotificationContext source) {
        return typeNamesByDiscriminator.getOrDefault(source.getType(), DEFAULT_TYPE);
    }
}
