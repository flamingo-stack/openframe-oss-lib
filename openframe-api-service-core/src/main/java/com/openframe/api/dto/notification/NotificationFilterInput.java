package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationCategory;
import com.openframe.data.document.notification.NotificationSeverity;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationFilterInput {
    private Boolean read;
    private List<NotificationCategory> categories;
    private List<String> types;
    private List<NotificationSeverity> severities;
}
