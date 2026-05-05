package com.openframe.api.integration.datafetcher.notification;

import com.openframe.data.document.notification.NotificationContext;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.EqualsAndHashCode;
import lombok.NoArgsConstructor;
import lombok.ToString;
import lombok.experimental.SuperBuilder;

/** Test-only context used by {@code NotificationDataFetcherIT}. */
@Data
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode(callSuper = true)
@ToString(callSuper = true)
public class TestApprovalContext extends NotificationContext {

    private String ticketId;
    private String approvalRequestId;
}
