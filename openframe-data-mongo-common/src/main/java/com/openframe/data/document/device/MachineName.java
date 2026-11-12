package com.openframe.data.document.device;

import static org.springframework.util.StringUtils.hasText;

// The name people know a device by: the technician's nickname, else the OS hostname.
public final class MachineName {

    private MachineName() {
    }

    public static String preferred(String nickname, String hostname) {
        if (hasText(nickname)) {
            return nickname;
        }
        return hostname;
    }
}
