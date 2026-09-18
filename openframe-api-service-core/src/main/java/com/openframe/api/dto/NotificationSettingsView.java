package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.List;

// Defaults are collapsed server-side: every group exactly once — the client never re-implements the defaulting rules.
@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class NotificationSettingsView {

    private boolean enabled;
    private List<NotificationTypeSetting> typeSettings;
}
