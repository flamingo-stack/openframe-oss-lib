package com.openframe.test.tests.ui;

import com.openframe.test.pages.DeviceDetailsPage;
import com.openframe.test.pages.FileManagerPage;
import com.openframe.test.pages.RemoteDesktopPage;
import com.openframe.test.pages.RemoteShellPage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;


@Tag("device")
class DeviceRemoteTest extends BaseUITest {

    DeviceDetailsPage deviceDetailsPage;

    @BeforeEach
    public void openDeviceDetails() {
        deviceDetailsPage = navigationSidebar.goToDevices().openDevice("vm114267");
    }

    @Test
    @DisplayName("Remote Shell: connect, execute command, and disconnect")
    public void testRemoteShell() {
        RemoteShellPage remoteShellPage = deviceDetailsPage.openRemoteShellPowerShell();
        List<String> terminalLines = remoteShellPage.getTerminalLines();
        assertThat(terminalLines).as("Terminal should have output after connection").isNotEmpty();
        remoteShellPage.executeCommand("dir");
        List<String> commandOutput = remoteShellPage.getTerminalLines();
        assertThat(commandOutput).as("Terminal output should grow after executing command").hasSizeGreaterThan(terminalLines.size());
        remoteShellPage.clickDisconnect();
    }

    @Test
    @DisplayName("Remote Desktop: canvas is visible and desktop loads")
    public void testRemoteDesktop() {
        RemoteDesktopPage rdPage = deviceDetailsPage.openRemoteDesktop();
        assertThat(rdPage.remoteDesktopCanvas().isVisible())
                .as("Remote desktop <canvas> must be visible")
                .isTrue();
        assertThat(rdPage.waitForDesktop()).as("Desktop must be loaded").isTrue();
    }

    @Test
    @DisplayName("File Manager: lists files in current folder")
    public void testRemoteFileManager() {
        FileManagerPage fileManagerPage = deviceDetailsPage.openFileManager();
        assertThat(fileManagerPage.getRowCount()).as("File manager should list at least one entry").isNotZero();
        assertThat(fileManagerPage.getCurrentFolder()).as("Current folder path should not be empty").isNotEmpty();
        assertThat(fileManagerPage.getRowName(0)).as("First row name should not be empty").isNotEmpty();
    }
}