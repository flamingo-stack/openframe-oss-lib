package com.openframe.client.service.rmm.osupdate.parser;

import com.openframe.client.metrics.DeviceOsReportMetrics;
import com.openframe.data.document.rmm.osupdate.OsPlatform;
import com.openframe.data.document.rmm.osupdate.OsUpdate;
import com.openframe.data.document.rmm.osupdate.OsUpdateRebootBehavior;
import com.openframe.data.document.rmm.osupdate.OsUpdateSeverity;
import com.openframe.data.nats.rmm.model.MachineOsUpdatesMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Spy;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;

import static org.mockito.Mockito.mock;
import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class OsUpdateParserTest {

    private static final String TENANT_ID = "tenant-1";
    private static final String MACHINE_ID = "machine-1";
    private static final String WINDOWS_IDENTIFIER = "a1b2c3d4-0000-4444-8888-99aabbccddee:201";
    private static final Instant RECEIVED_AT = Instant.parse("2026-11-20T09:14:03.120Z");
    private static final Instant PUBLISHED_AT = Instant.parse("2026-11-11T18:00:00Z");

    @Spy private ReportedEnumParser reportedEnumParser = new ReportedEnumParser(mock(DeviceOsReportMetrics.class));

    @InjectMocks private OsUpdateParser parser;

    private MachineOsUpdatesMessage.UpdateItem windowsItem;
    private MachineOsUpdatesMessage.WindowsUpdate windowsUpdate;
    private ReportingDevice windowsDevice;
    private ReportingDevice macDevice;

    @BeforeEach
    void setUp() {
        windowsUpdate = new MachineOsUpdatesMessage.WindowsUpdate();
        windowsItem = new MachineOsUpdatesMessage.UpdateItem();
        windowsItem.setIdentifier(WINDOWS_IDENTIFIER);
        windowsItem.setDisplayName("2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)");
        windowsItem.setWindows(windowsUpdate);
        windowsDevice = reportingDevice(OsPlatform.WINDOWS);
        macDevice = reportingDevice(OsPlatform.MACOS);
    }

    @Test
    void parse_windowsUpdate_describedWithEverythingWindowsSaysAboutIt() {
        // setup
        windowsUpdate.setKbArticleIds(List.of("5051987"));
        windowsUpdate.setMsrcSeverity("Critical");
        windowsUpdate.setCategories(List.of(category("Security Updates"), category("Windows 11")));
        windowsUpdate.setCveIds(List.of("CVE-2026-21309", "CVE-2026-21311"));
        windowsUpdate.setPublishedAt(PUBLISHED_AT);
        windowsUpdate.setMaxDownloadBytes(764317696L);
        windowsUpdate.setIsDownloaded(true);
        windowsUpdate.setRebootBehavior("ALWAYS");
        windowsUpdate.setBrowseOnly(false);
        OsUpdate expected = OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(WINDOWS_IDENTIFIER)
                .displayName("2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)")
                .kbArticleIds(List.of("5051987"))
                .severity(OsUpdateSeverity.CRITICAL)
                .categories(List.of("Security Updates", "Windows 11"))
                .cveIds(List.of("CVE-2026-21309", "CVE-2026-21311"))
                .publishedAt(PUBLISHED_AT)
                .sizeBytes(764317696L)
                .rebootBehavior(OsUpdateRebootBehavior.ALWAYS)
                .browseOnly(false)
                .firstSeenAt(RECEIVED_AT)
                .build();

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, List.of(windowsItem));

        // verifications
        assertThat(osUpdates).containsExactly(expected);
    }

    @Test
    void parse_macUpdate_nameAndVersionOnly() {
        // setup
        MachineOsUpdatesMessage.MacosUpdate macosUpdate = new MachineOsUpdatesMessage.MacosUpdate();
        macosUpdate.setPresence("FRESH");
        MachineOsUpdatesMessage.UpdateItem macItem = new MachineOsUpdatesMessage.UpdateItem();
        macItem.setIdentifier("MSU_UPDATE_25C56_patch_26.2");
        macItem.setDisplayName("macOS Sequoia 26.2");
        macItem.setDisplayVersion("26.2");
        macItem.setMacos(macosUpdate);
        OsUpdate expected = OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.MACOS)
                .identifier("MSU_UPDATE_25C56_patch_26.2")
                .displayName("macOS Sequoia 26.2")
                .displayVersion("26.2")
                .firstSeenAt(RECEIVED_AT)
                .build();

        // execution
        List<OsUpdate> osUpdates = parser.parse(macDevice, List.of(macItem));

        // verifications
        assertThat(osUpdates).containsExactly(expected);
    }

    @Test
    void parse_windowsUpdateWithNothingInItsBlock_emptyListsAndNoSeverity() {
        // setup
        OsUpdate expected = OsUpdate.builder()
                .tenantId(TENANT_ID)
                .platform(OsPlatform.WINDOWS)
                .identifier(WINDOWS_IDENTIFIER)
                .displayName("2026-11 Cumulative Update for Windows 11 Version 24H2 (KB5051987)")
                .kbArticleIds(List.of())
                .categories(List.of())
                .cveIds(List.of())
                .firstSeenAt(RECEIVED_AT)
                .build();

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, List.of(windowsItem));

        // verifications
        assertThat(osUpdates).containsExactly(expected);
    }

    @ParameterizedTest
    @CsvSource({
            "Critical,    CRITICAL",
            "IMPORTANT,   IMPORTANT",
            "moderate,    MODERATE",
            "Low,         LOW",
            "Unspecified, ",
            "'',          "
    })
    void parse_msrcSeverity_mappedWithoutRegardToCaseAndAnUnknownOneIsNoSeverity(
            String msrcSeverity, OsUpdateSeverity expected) {
        // setup
        windowsUpdate.setMsrcSeverity(msrcSeverity);

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, List.of(windowsItem));

        // verifications
        assertThat(osUpdates).extracting(OsUpdate::getSeverity).containsExactly(expected);
    }

    @Test
    void parse_categoryWithoutANameAndANullCategory_leftOut() {
        // setup
        windowsUpdate.setCategories(Arrays.asList(category("Security Updates"), category(null), null));

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, List.of(windowsItem));

        // verifications
        assertThat(osUpdates).extracting(OsUpdate::getCategories).containsExactly(List.of("Security Updates"));
    }

    @Test
    void parse_rebootBehaviorTheBackendDoesNotKnow_noRebootBehavior() {
        // setup
        windowsUpdate.setRebootBehavior("SOMETIMES");

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, List.of(windowsItem));

        // verifications
        assertThat(osUpdates).extracting(OsUpdate::getRebootBehavior).containsOnlyNulls().hasSize(1);
    }

    @Test
    void parse_noItems_noUpdates() {
        // setup
        List<MachineOsUpdatesMessage.UpdateItem> noItems = List.of();

        // execution
        List<OsUpdate> osUpdates = parser.parse(windowsDevice, noItems);

        // verifications
        assertThat(osUpdates).isEmpty();
    }

    private static MachineOsUpdatesMessage.WindowsUpdateCategory category(String name) {
        MachineOsUpdatesMessage.WindowsUpdateCategory category = new MachineOsUpdatesMessage.WindowsUpdateCategory();
        category.setName(name);
        return category;
    }

    private static ReportingDevice reportingDevice(OsPlatform platform) {
        return ReportingDevice.builder()
                .tenantId(TENANT_ID)
                .machineId(MACHINE_ID)
                .platform(platform)
                .receivedAt(RECEIVED_AT)
                .build();
    }
}
