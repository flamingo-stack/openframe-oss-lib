package com.openframe.data.document.notification;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/**
 * Polymorphic payload carried inside {@link Notification#getContext()}.
 * The {@code type} field is the discriminator across NATS wire, GraphQL response,
 * and Mongo storage. {@code _class} is suppressed for this hierarchy so
 * {@code type} stays the single source of truth — see {@code NotificationContextSelectiveTypeMapper}.
 *
 * <p>Subclasses must register a {@link NotificationContextBinding} bean.
 */
@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.EXISTING_PROPERTY,
        property = "type",
        visible = true,
        defaultImpl = GenericContext.class)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public abstract class NotificationContext {

    private String type;
}
