package com.openframe.api.dto;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.util.List;

// Defaults are collapsed server-side: every group exactly once — the client never re-implements the defaulting rules.
@Getter
@AllArgsConstructor
public class NotificationSettingsView {

    private final boolean enabled;
    private final List<NotificationTypeSetting> typeSettings;
}
