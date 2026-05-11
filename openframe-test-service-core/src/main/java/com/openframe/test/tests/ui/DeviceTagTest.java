package com.openframe.test.tests.ui;

import com.microsoft.playwright.assertions.PlaywrightAssertions;
import com.openframe.test.pages.DevicesPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

@Tag("device")
public class DeviceTagTest extends BaseUITest {

    DevicesPage devicesPage;

    // ── Test data ─────────────────────────────────────────────────────────────
    private static final String TAG_KEY = "purpose";
    private static final String TAG_VALUE = "auto_test";
    private static final String EXPECTED_CHIP = TAG_KEY + ":" + TAG_VALUE;  // "purpose:auto_test"
    private static final String DEVICE_NAME = "vm115982";

    // ── Precondition guard ────────────────────────────────────────────────────

    @BeforeEach
    public void openDeviceDetails() {
        devicesPage = navigationSidebar.goToDevices();
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("Filter by tag")
    void testFilterByTag() {
        devicesPage.filterByTag(TAG_KEY, TAG_VALUE);

        assertThat(devicesPage.deviceRows().count())
                .as("Expected to have listed devices", TAG_KEY, TAG_VALUE)
                .isNotZero();

        PlaywrightAssertions.assertThat(devicesPage.deviceRowByName(DEVICE_NAME))
                .isVisible();

        PlaywrightAssertions.assertThat(devicesPage.activeFilterChip(EXPECTED_CHIP))
                .isVisible();

    }

}
