package com.openframe.api.dto.rmm.software;

import lombok.AllArgsConstructor;
import lombok.Getter;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

@Getter
@AllArgsConstructor
public class SoftwareActionId {

    private final String executionId;
    private final String bundleId;
    private final String scheduleId;

    private static final String SEP = ":"; // absent in UUIDs / Mongo ObjectIds, and not regex-special

    public String encode() {
        String raw = nullToEmpty(executionId) + SEP + nullToEmpty(bundleId) + SEP + nullToEmpty(scheduleId);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    public static SoftwareActionId of(String executionId, String bundleId, String scheduleId) {
        return new SoftwareActionId(executionId, bundleId, scheduleId);
    }

    public static SoftwareActionId decode(String actionId) {
        if (actionId == null || actionId.isBlank()) {
            return new SoftwareActionId(null, null, null);
        }
        try {
            String raw = new String(Base64.getUrlDecoder().decode(actionId), StandardCharsets.UTF_8);
            String[] parts = raw.split(SEP, -1);
            if (parts.length == 3) {
                return new SoftwareActionId(emptyToNull(parts[0]), emptyToNull(parts[1]), emptyToNull(parts[2]));
            }
        } catch (IllegalArgumentException ignored) {
        }
        return new SoftwareActionId(actionId, null, null);
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String emptyToNull(String s) {
        return s == null || s.isEmpty() ? null : s;
    }
}
