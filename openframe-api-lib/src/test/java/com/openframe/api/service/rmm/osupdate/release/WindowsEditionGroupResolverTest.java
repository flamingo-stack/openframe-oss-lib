package com.openframe.api.service.rmm.osupdate.release;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.NullAndEmptySource;

import static org.assertj.core.api.Assertions.assertThat;

class WindowsEditionGroupResolverTest {

    private final WindowsEditionGroupResolver windowsEditionGroupResolver = new WindowsEditionGroupResolver();

    @ParameterizedTest
    @CsvSource({
            "Windows 11 Home, HOME_AND_PRO",
            "Windows 11 Pro, HOME_AND_PRO",
            "Windows 11 Pro for Workstations, HOME_AND_PRO",
            "Windows 11 Pro Education, HOME_AND_PRO",
            "Windows 10 Pro, HOME_AND_PRO",
            "Windows 11 Enterprise, ENTERPRISE_AND_EDUCATION",
            "Windows 11 Enterprise multi-session, ENTERPRISE_AND_EDUCATION",
            "Windows 11 Education, ENTERPRISE_AND_EDUCATION",
            "Windows 11 IoT Enterprise, ENTERPRISE_AND_EDUCATION",
            "windows 10 enterprise, ENTERPRISE_AND_EDUCATION",
            "Windows 11 Enterprise LTSC 2024, ENTERPRISE_LTSC",
            "Windows 10 Enterprise LTSC 2021, ENTERPRISE_LTSC",
            "Windows 11 IoT Enterprise LTSC 2024, IOT_ENTERPRISE_LTSC",
            "Windows 10 IoT Enterprise LTSC 2021, IOT_ENTERPRISE_LTSC",
            "windows 11 iot enterprise ltsc, IOT_ENTERPRISE_LTSC"})
    void resolve_productName_itsEditionGroup(String osProductName, WindowsEditionGroup expected) {
        // setup

        // execution
        WindowsEditionGroup windowsEditionGroup = windowsEditionGroupResolver.resolve(osProductName);

        // verifications
        assertThat(windowsEditionGroup).isEqualTo(expected);
    }

    @ParameterizedTest
    @NullAndEmptySource
    void resolve_noProductName_homeAndPro(String osProductName) {
        // setup

        // execution
        WindowsEditionGroup windowsEditionGroup = windowsEditionGroupResolver.resolve(osProductName);

        // verifications
        assertThat(windowsEditionGroup).isEqualTo(WindowsEditionGroup.HOME_AND_PRO);
    }
}
