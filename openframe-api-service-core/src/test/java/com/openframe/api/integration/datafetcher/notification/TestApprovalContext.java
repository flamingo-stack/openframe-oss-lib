package com.openframe.api.integration.datafetcher.notification;

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
public class TestApprovalContext extends NotificationContext {

    public static final String TYPE = TestApprovalContextDescriptor.TYPE;

    private String ticketId;
    private String approvalRequestId;

    @Override
    public String getType() {
        return TYPE;
    }
}
