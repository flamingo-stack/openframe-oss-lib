package com.openframe.data.integration.document.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.openframe.data.document.notification.NotificationContext;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

@JsonIgnoreProperties(value = "type", allowGetters = true)
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class TestExtendedContext extends NotificationContext {

    public static final String TYPE = "TEST_EXTENDED_CONTEXT";

    private String extraField;
    private int extraNumber;

    @Override
    public String getType() {
        return TYPE;
    }
}
