package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

// The caller's notificationSettings: the master switch plus every NotificationSettingGroup exactly once, defaults resolved.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationSettings {
    private Boolean enabled;
    private List<NotificationTypeSetting> typeSettings;

    public List<NotificationTypeSettingInput> toInputs() {
        return typeSettings.stream()
                .map(s -> NotificationTypeSettingInput.builder().group(s.getGroup()).enabled(s.getEnabled()).build())
                .toList();
    }
}
