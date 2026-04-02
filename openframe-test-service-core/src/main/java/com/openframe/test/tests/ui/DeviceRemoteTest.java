package com.openframe.test.tests.ui;

import com.openframe.test.pages.DeviceDetailsPage;
import com.openframe.test.pages.FileManagerPage;
import com.openframe.test.pages.RemoteDesktopPage;
import com.openframe.test.pages.RemoteShellPage;
import org.junit.jupiter.api.*;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;


@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class DeviceRemoteTest extends BaseUITest {

    DeviceDetailsPage deviceDetailsPage;

    @BeforeEach
    public void openDeviceDetails() {
        deviceDetailsPage = navigationSidebar.goToDevices().openDevice("vm114267");
    }

    @AfterEach
    public void backToDevices() {
        navigationSidebar.goToDevices();
    }

    @Test
    public void testRemoteShell() {
        RemoteShellPage remoteShellPage = deviceDetailsPage.openRemoteShellPowerShell();
        List<String> terminalLines = remoteShellPage.getTerminalLines();
        assertThat(terminalLines).isNotEmpty();
        remoteShellPage.executeCommand("dir");
        List<String> commandOutput = remoteShellPage.getTerminalLines();
        assertThat(commandOutput).hasSizeGreaterThan(terminalLines.size());
        remoteShellPage.clickDisconnect();
    }

    @Test
    public void testRemoteDesktop() {
        RemoteDesktopPage rdPage = deviceDetailsPage.openRemoteDesktop();
        assertThat(rdPage.remoteDesktopCanvas().isVisible())
                .as("Remote desktop <canvas> must be visible")
                .isTrue();
        assertThat(rdPage.waitForDesktop()).as("Desktop must be loaded").isTrue();
    }

    @Test
    public void testRemoteFileManager() {
        FileManagerPage fileManagerPage = deviceDetailsPage.openFileManager();
        List<String> rows = fileManagerPage.getAllRowNames();
        assertThat(rows).isNotEmpty();
    }
}