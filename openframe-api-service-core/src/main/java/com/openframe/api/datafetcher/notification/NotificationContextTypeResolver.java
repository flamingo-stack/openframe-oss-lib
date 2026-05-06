package com.openframe.api.datafetcher.notification;

import com.openframe.data.document.notification.NotificationContext;

/**
 * SPI mapping a runtime {@link NotificationContext} to its GraphQL type name.
 * Return the type name for sources you recognise, {@code null} otherwise.
 *
 * <p>Annotate implementations with {@link org.springframework.core.annotation.Order @Order}
 * — without it dispatch is at the mercy of bean-discovery order, which differs
 * across deployments. Design subtypes so each is owned by exactly one resolver.
 */
public interface NotificationContextTypeResolver {

    String resolveTypeName(NotificationContext source);
}
