package com.openframe.api.dto.notification;

import com.openframe.data.document.notification.NotificationEntityType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationEntityFilterInput {
    private NotificationEntityType type;
    private String id;
}
