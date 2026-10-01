package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.SoftwareBundleApi;
import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.schedule.ScheduleDeviceEdge;
import com.openframe.test.data.dto.softwarebundle.SoftwareBundle;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Staging a software bundle (CP-22): one PENDING draft of our own is created, given devices one by one and by filter+search, and deleted; nothing is submitted, so nothing dispatches.
@Tag("saas")
@Tag("needs-device")
@Tag("software-bundles")
@DisplayName("Software bundles")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class SoftwareBundleTest extends BaseTest {

    private static final String WINDOWS = "WINDOWS";
    // The enrolled Windows box on qa; the tenant also holds PENDING_DELETION copies of it, so the ONLINE one is preferred.
    private static final String HOSTNAME = "vm115982";
    private static final RunId RUN_ID = RunId.next();
    // A hostname search no device matches, for the remove-all no-op.
    private static final String NO_SUCH_HOST = "e2e-no-such-host-" + RUN_ID;
    private static final int PAGE = 50;

    private static Machine device;
    private static String bundleId;

    @BeforeAll
    public static void pickDevice() {
        device = DeviceApi.getDevices(DeviceGenerator.osDevicesFilter(WINDOWS)).stream()
                .filter(d -> HOSTNAME.equals(d.getHostname()))
                .min(Comparator.comparing((Machine d) -> d.getStatus() != DeviceStatus.ONLINE))
                .orElse(null);
    }

    @Tag("feature")
    @Test
    @DisplayName("Create an empty draft software bundle")
    @Order(1)
    public void testCreateBundle() {
        SoftwareBundle created = SoftwareBundleApi.createBundle();
        bundleId = created.getId();

        assertThat(RelayIds.decode(bundleId)).as("The bundle id is a SoftwareBundle global id").startsWith("SoftwareBundle:");
        assertThat(created.getStatus()).as("A new bundle is a PENDING draft").isEqualTo("PENDING");
        assertThat(created.getDeviceCount()).as("A new bundle has no devices").isZero();
        assertThat(created.getPackages()).as("A new bundle has no packages").isEmpty();
        assertThat(created.getAction()).as("action is null while PENDING").isNull();
        assertThat(created.getMode()).as("mode is null while PENDING").isNull();
        assertThat(created.getCompletedAt()).as("completedAt is null while PENDING").isNull();
        assertThat(created.getScheduleId()).as("scheduleId is null while PENDING").isNull();
        assertThat(created.getExecutionIds()).as("executionIds are null or empty while PENDING").isNullOrEmpty();
        assertThat(created.getCreatedBy()).as("The draft records its creator").isNotBlank();
        assertThat(created.getCreatedAt()).as("The draft records its creation time").isNotBlank();

        SoftwareBundle fetched = SoftwareBundleApi.getBundle(bundleId);
        assertThat(fetched).as("softwareBundle finds the new draft").isNotNull();
        assertThat(fetched.getId()).as("softwareBundle returns the requested bundle").isEqualTo(bundleId);
        assertThat(fetched.getStatus()).as("The draft is persisted as PENDING").isEqualTo("PENDING");
        assertThat(fetched.getDeviceCount()).as("The draft is persisted with no devices").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Assign a device to a software bundle")
    @Order(2)
    public void testAddDevices() {
        requireBundleAndDevice();
        SoftwareBundle before = SoftwareBundleApi.getBundleDevices(bundleId, null, HOSTNAME, PAGE);
        assertThat(before.getAssignedDevices().ids()).as("Nothing is assigned yet").isEmpty();
        assertThat(before.getAvailableDevices().edgeFor(device.getId()).map(ScheduleDeviceEdge::getAssigned))
                .as("The picker offers " + HOSTNAME + " with assigned=false").contains(false);

        SoftwareBundle added = SoftwareBundleApi.addDevices(bundleId, List.of(device.getId()));
        assertThat(added.getDeviceCount()).as("deviceCount after assigning one device").isEqualTo(1);
        assertThat(added.getStatus()).as("Assigning devices keeps the bundle PENDING").isEqualTo("PENDING");

        SoftwareBundle after = SoftwareBundleApi.getBundleDevices(bundleId, null, HOSTNAME, PAGE);
        assertThat(after.getDeviceCount()).as("deviceCount is persisted").isEqualTo(1);
        assertThat(after.getAssignedDevices().ids()).as("The device is in assignedDevices").containsExactly(device.getId());
        assertThat(after.getAvailableDevices().edgeFor(device.getId()).map(ScheduleDeviceEdge::getAssigned))
                .as("The picker edge flips to assigned=true").contains(true);

        assertThat(SoftwareBundleApi.addDevices(bundleId, List.of(device.getId())).getDeviceCount())
                .as("Re-adding an assigned id is skipped").isEqualTo(1);
        String clientEncoded = RelayIds.toGlobalId("Machine", device.getMachineId());
        assertThat(SoftwareBundleApi.addDevices(bundleId, List.of(clientEncoded)).getDeviceCount())
                .as("A Machine global id encoded from the raw machineId is the same device, so it is skipped too").isEqualTo(1);
    }

    @Tag("feature")
    @Test
    @DisplayName("Unassign a device from a software bundle")
    @Order(3)
    public void testRemoveDevices() {
        requireBundleAndDevice();
        SoftwareBundle removed = SoftwareBundleApi.removeDevices(bundleId, List.of(device.getId()));
        assertThat(removed.getDeviceCount()).as("deviceCount after unassigning").isZero();

        SoftwareBundle after = SoftwareBundleApi.getBundleDevices(bundleId, null, HOSTNAME, PAGE);
        assertThat(after.getAssignedDevices().ids()).as("The device left assignedDevices").isEmpty();
        assertThat(after.getAvailableDevices().edgeFor(device.getId()).map(ScheduleDeviceEdge::getAssigned))
                .as("The picker edge flips back to assigned=false").contains(false);

        String neverAssigned = RelayIds.toGlobalId("Machine", "e2e-never-assigned-" + RUN_ID);
        assertThat(SoftwareBundleApi.removeDevices(bundleId, List.of(device.getId(), neverAssigned)).getDeviceCount())
                .as("Removing ids that are not assigned is a no-op").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Assign every device matching a filter and search")
    @Order(4)
    public void testAddAllDevices() {
        requireBundleAndDevice();
        DeviceFilterInput windows = DeviceGenerator.osDevicesFilter(WINDOWS);
        SoftwareBundle before = SoftwareBundleApi.getBundleDevices(bundleId, windows, HOSTNAME, PAGE);
        int offered = before.getAvailableDevices().getFilteredCount();
        assertThat(offered).as("availableDevices for " + HOSTNAME + " counts at least our device").isGreaterThanOrEqualTo(1);
        assertThat(before.getDeviceCount()).as("The bundle is empty before add-all").isZero();

        SoftwareBundle added = SoftwareBundleApi.addAllDevices(bundleId, windows, HOSTNAME);
        assertThat(added.getDeviceCount()).as("Add-all assigns exactly what availableDevices offers for the same filter and search")
                .isEqualTo(offered);

        SoftwareBundle after = SoftwareBundleApi.getBundleDevices(bundleId, windows, HOSTNAME, PAGE);
        assertThat(after.getAssignedDevices().getFilteredCount()).as("assignedDevices counts every added device").isEqualTo(offered);
        assertThat(after.getAssignedDevices().ids()).as("Our device is among the assigned").contains(device.getId());
        assertThat(after.getAvailableDevices().getEdges()).extracting(ScheduleDeviceEdge::getAssigned)
                .as("Every offered device is now marked assigned").containsOnly(true);

        assertThat(SoftwareBundleApi.addAllDevices(bundleId, windows, HOSTNAME).getDeviceCount())
                .as("Repeating add-all skips the already-assigned devices").isEqualTo(offered);
    }

    @Tag("feature")
    @Test
    @DisplayName("Unassign every device matching a filter and search")
    @Order(5)
    public void testRemoveAllDevices() {
        requireBundleAndDevice();
        DeviceFilterInput windows = DeviceGenerator.osDevicesFilter(WINDOWS);
        int assigned = SoftwareBundleApi.getBundle(bundleId).getDeviceCount();
        assumeTrue(assigned > 0, "Nothing was assigned in \"Assign every device matching a filter and search\"; see that failure");

        assertThat(SoftwareBundleApi.removeAllDevices(bundleId, windows, NO_SUCH_HOST).getDeviceCount())
                .as("Remove-all with a search nothing matches leaves the assignment alone").isEqualTo(assigned);

        SoftwareBundle removed = SoftwareBundleApi.removeAllDevices(bundleId, windows, HOSTNAME);
        assertThat(removed.getDeviceCount()).as("Remove-all with the add-all filter and search unassigns them all").isZero();
        assertThat(SoftwareBundleApi.getBundleDevices(bundleId, windows, HOSTNAME, PAGE).getAssignedDevices().getFilteredCount())
                .as("assignedDevices is empty after remove-all").isZero();

        assertThat(SoftwareBundleApi.addDevices(bundleId, List.of(device.getId())).getDeviceCount())
                .as("The device is assigned again for the unfiltered remove-all").isEqualTo(1);
        assertThat(SoftwareBundleApi.removeAllDevices(bundleId, null, null).getDeviceCount())
                .as("Remove-all with no filter and no search clears the whole assignment").isZero();
    }

    @Tag("feature")
    @Test
    @DisplayName("Delete a draft software bundle")
    @Order(6)
    public void testDeleteBundle() {
        requireBundle();
        String deletedId = bundleId;

        assertThat(SoftwareBundleApi.deleteBundle(deletedId)).as("Deleting a PENDING bundle returns true").isTrue();
        bundleId = null;
        assertThat(SoftwareBundleApi.getBundle(deletedId)).as("softwareBundle returns null for a deleted bundle").isNull();

        assertThat(SoftwareBundleApi.deleteBundle(deletedId)).as("Deleting an already deleted bundle returns true").isTrue();
        String unknown = RelayIds.toGlobalId("SoftwareBundle", RUN_ID.toString());
        assertThat(SoftwareBundleApi.deleteBundle(unknown)).as("Deleting an unknown bundle id returns true").isTrue();
    }

    // Deletes the draft when a case failed before "Delete a draft software bundle"; the delete takes its devices with it.
    @AfterAll
    public static void cleanup() {
        if (bundleId != null) {
            SoftwareBundleApi.attemptDeleteBundle(bundleId);
        }
    }

    private static void requireBundle() {
        assumeTrue(bundleId != null, "No bundle was created in \"Create an empty draft software bundle\"; see that failure");
    }

    private static void requireBundleAndDevice() {
        requireBundle();
        assumeTrue(device != null && device.getId() != null,
                "Device " + HOSTNAME + " is not listed among the " + WINDOWS + " devices; the device cases need it");
    }
}
