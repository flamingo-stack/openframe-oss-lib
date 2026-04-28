package com.openframe.test.tests.ui;

import com.openframe.test.pages.MonitoringPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("scheduled")
@DisplayName("Monitoring")
public class MonitoringTest extends BaseUITest {

    MonitoringPage monitoringPage;

    @BeforeEach
    public void openMonitoring() {
        monitoringPage = navigationSidebar.goToMonitoring();
    }

    @Test
    @DisplayName("Empty policy status is compliant")
    public void testEmptyPolicyStatus() {
        assertThat(monitoringPage.getPolicyStatusByName("Empty")).isEqualTo("Compliant");
    }

    @Test
    @DisplayName("Windows version policy status is compliant")
    public void testWindowsVersionPolicyStatus() {
        assertThat(monitoringPage.getPolicyStatusByName("Windows version")).isEqualTo("Compliant");
    }
}
