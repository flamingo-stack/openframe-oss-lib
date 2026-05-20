package com.openframe.data.document.notification;

import com.fasterxml.jackson.annotation.JsonTypeInfo;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

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
