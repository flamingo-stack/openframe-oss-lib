package com.openframe.api.service.rmm.osupdate.release;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import static org.apache.commons.lang3.StringUtils.containsIgnoreCase;

@Component
@ConditionalOnProperty(name = "openframe.rmm.os-update.enabled", havingValue = "true")
public class WindowsEditionGroupResolver {

    private static final String IOT = "IoT";
    private static final String LTSC = "LTSC";
    private static final String ENTERPRISE = "Enterprise";
    private static final String EDUCATION = "Education";
    // WARNING: Pro Education is serviced as long as Pro, not as long as Education
    private static final String PRO_EDUCATION = "Pro Education";

    // osProductName as the agent reports it: "Windows 11 Enterprise LTSC 2024". No name = Home and Pro.
    public WindowsEditionGroup resolve(String osProductName) {
        if (containsIgnoreCase(osProductName, LTSC)) {
            return containsIgnoreCase(osProductName, IOT)
                    ? WindowsEditionGroup.IOT_ENTERPRISE_LTSC
                    : WindowsEditionGroup.ENTERPRISE_LTSC;
        }
        boolean education = containsIgnoreCase(osProductName, EDUCATION)
                && !containsIgnoreCase(osProductName, PRO_EDUCATION);
        if (containsIgnoreCase(osProductName, ENTERPRISE) || education) {
            return WindowsEditionGroup.ENTERPRISE_AND_EDUCATION;
        }
        return WindowsEditionGroup.HOME_AND_PRO;
    }
}
