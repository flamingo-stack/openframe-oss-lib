package com.openframe.api.dto;

import com.openframe.data.document.notification.NotificationSettingGroup;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class NotificationTypeSettingInput {
    private NotificationSettingGroup group;
    private boolean enabled;
}
