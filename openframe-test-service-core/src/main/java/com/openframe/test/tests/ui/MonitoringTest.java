package com.openframe.test.tests.ui;

import com.openframe.test.pages.MonitoringPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("scheduled")
public class MonitoringTest extends BaseUITest {

    MonitoringPage monitoringPage;

    @BeforeEach
    public void openMonitoring() {
        monitoringPage = navigationSidebar.goToMonitoring();
    }

    @Test
    public void testEmptyPolicyStatus() {
        assertThat(monitoringPage.getPolicyStatusByName("Empty")).isEqualTo("Compliant");
    }

    @Test
    public void testWindowsVersionPolicyStatus() {
        assertThat(monitoringPage.getPolicyStatusByName("Windows version")).isEqualTo("Compliant");
    }
}
