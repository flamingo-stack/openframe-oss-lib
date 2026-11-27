package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.DeviceOsPendingUpdate;
import com.openframe.data.document.rmm.osupdate.MacosUpdatePresence;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;

@ExtendWith(MockitoExtension.class)
class DeviceOsPendingUpdateParserTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String ORGANIZATION_ID = "org-1";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");

    @Spy private ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));

    @InjectMocks private DeviceOsPendingUpdateParser parser;

    @Test
    void parse_windowsUpdate_pendingOnThatDeviceSinceThisReportWithItsDownloadState() {
        // setup
        MachineOsUpdatesMessage.WindowsUpdate windows = new MachineOsUpdatesMessage.WindowsUpdate();
        windows.setIsDownloaded(true);
        MachineOsUpdatesMessage.UpdateItem item = item("a1b2c3d4-0000-4444-8888-99aabbccddee:201");
        item.setWindows(windows);
        DeviceOsPendingUpdate expected = DeviceOsPendingUpdate.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .organizationId(ORGANIZATION_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier("a1b2c3d4-0000-4444-8888-99aabbccddee:201")
                .discoveredAt(RECEIVED_AT)
                .downloaded(true)
                .build();

        // execution
        List<DeviceOsPendingUpdate> pendingUpdates = parser.parse(reportingDevice(OsPlatform.WINDOWS), List.of(item));

        // verifications
        assertThat(pendingUpdates).containsExactly(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "FRESH,           FRESH",
            "HELD_OVER,       HELD_OVER",
            "held_over,       HELD_OVER",
            "SOMETHING_NEW,   ",
            ",                "
    })
    void parse_macUpdate_presenceAsTheMacSaidItAndNoDownloadState(String presence, MacosUpdatePresence expected) {
        // setup
        MachineOsUpdatesMessage.MacosUpdate macos = new MachineOsUpdatesMessage.MacosUpdate();
        macos.setPresence(presence);
        MachineOsUpdatesMessage.UpdateItem item = item("Safari-18.2");
        item.setMacos(macos);

        // execution
        List<DeviceOsPendingUpdate> pendingUpdates = parser.parse(reportingDevice(OsPlatform.MACOS), List.of(item));

        // verifications
        assertThat(pendingUpdates)
                .extracting(DeviceOsPendingUpdate::getIdentifier, DeviceOsPendingUpdate::getPlatform,
                        DeviceOsPendingUpdate::getMacosPresence, DeviceOsPendingUpdate::getDownloaded,
                        DeviceOsPendingUpdate::getDiscoveredAt)
                .containsExactly(tuple("Safari-18.2", OsPlatform.MACOS, expected, null, RECEIVED_AT));
    }

    @Test
    void parse_itemWithoutAPlatformBlock_noDownloadStateAndNoPresence() {
        // setup
        MachineOsUpdatesMessage.UpdateItem item = item("Safari-18.2");

        // execution
        List<DeviceOsPendingUpdate> pendingUpdates = parser.parse(reportingDevice(OsPlatform.MACOS), List.of(item));

        // verifications
        assertThat(pendingUpdates)
                .extracting(DeviceOsPendingUpdate::getDownloaded, DeviceOsPendingUpdate::getMacosPresence)
                .containsExactly(tuple(null, null));
    }

    @Test
    void parse_severalItems_onePendingUpdateEachInTheReportedOrder() {
        // setup
        List<MachineOsUpdatesMessage.UpdateItem> items = List.of(item("first"), item("second"), item("third"));

        // execution
        List<DeviceOsPendingUpdate> pendingUpdates = parser.parse(reportingDevice(OsPlatform.MACOS), items);

        // verifications
        assertThat(pendingUpdates).extracting(DeviceOsPendingUpdate::getIdentifier)
                .containsExactly("first", "second", "third");
    }

    @Test
    void parse_noItems_noPendingUpdates() {
        // setup
        List<MachineOsUpdatesMessage.UpdateItem> noItems = List.of();

        // execution
        List<DeviceOsPendingUpdate> pendingUpdates = parser.parse(reportingDevice(OsPlatform.MACOS), noItems);

        // verifications
        assertThat(pendingUpdates).isEmpty();
    }

    private static MachineOsUpdatesMessage.UpdateItem item(String identifier) {
        MachineOsUpdatesMessage.UpdateItem item = new MachineOsUpdatesMessage.UpdateItem();
        item.setIdentifier(identifier);
        return item;
    }

    private static ReportingDevice reportingDevice(OsPlatform platform) {
        return ReportingDevice.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .organizationId(ORGANIZATION_ID)
                .platform(platform)
                .receivedAt(RECEIVED_AT)
                .build();
    }
}
