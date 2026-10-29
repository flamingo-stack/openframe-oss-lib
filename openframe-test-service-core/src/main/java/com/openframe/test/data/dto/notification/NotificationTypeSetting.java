package com.openframe.test.data.dto.notification;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

// One "Notify about" checkbox; label is a server-rendered caption, never mapped from the group on the client.
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class NotificationTypeSetting {
    private String group;
    private String label;
    private Boolean enabled;
}
