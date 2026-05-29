package com.openframe.data.document.notification;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

@JsonTypeInfo(
        use = JsonTypeInfo.Id.NAME,
        include = JsonTypeInfo.As.EXISTING_PROPERTY,
        property = "type",
        visible = true,
        defaultImpl = GenericContext.class)
@SuperBuilder
@NoArgsConstructor
public abstract class NotificationContext {

    public abstract String getType();
}
