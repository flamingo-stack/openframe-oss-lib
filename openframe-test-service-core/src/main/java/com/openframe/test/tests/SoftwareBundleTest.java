package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.SoftwareActionApi;
import com.openframe.test.api.SoftwareBundleApi;
import com.openframe.test.config.MachineConfig;
import com.openframe.test.data.dto.device.DeviceFilterInput;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.schedule.ScheduleDeviceEdge;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.softwareaction.SoftwareActionFilterInput;
import com.openframe.test.data.dto.softwareaction.SoftwareActionRun;
import com.openframe.test.data.dto.softwarebundle.SoftwareBundle;
import com.openframe.test.data.dto.softwarebundle.SoftwareBundlePackage;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.helpers.FleetWait;
import com.openframe.test.helpers.RelayIds;
import com.openframe.test.helpers.ai.RunId;
import com.openframe.test.helpers.ai.SshMachineVerifier;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

import static com.openframe.test.data.generator.SoftwareBundleGenerator.HARMLESS_WINGET_PACKAGE;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.INSTALL;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.UPDATE;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.WINGET;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.submitNow;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.untypedBrewPackage;
import static com.openframe.test.data.generator.SoftwareBundleGenerator.wingetPackage;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.tuple;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

// Staging a software bundle (CP-22: one PENDING draft of our own gets devices one by one and by filter+search, then is deleted) and submitting one (CP-23: a second bundle is refused while invalid, then installs 7-Zip on vm115982 for real and it is uninstalled over SSH).
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
    // The box must not have it before the install, and has it removed after.
    private static final String PACKAGE = HARMLESS_WINGET_PACKAGE;
    // The DisplayName its installer registers under Uninstall, e.g. "7-Zip 24.09 (x64)".
    private static final String PROGRAM = "7-Zip*";
    // Bundle runs are dispatched by a 60s online sweep, then winget runs under a 90s script timeout on a box other agents share.
    private static final int INSTALL_TIMEOUT_SECONDS = 600;
    private static final List<String> FINISHED = List.of("COMPLETED", "FAILED");

    private static Machine device;
    private static String bundleId;
    private static String installBundleId;
    private static SoftwareBundle submitted;
    // True from the install submit until the uninstall is verified, so the cleanup knows the box may still hold the package.
    private static boolean packageOnBox;

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

    @Tag("feature")
    @Test
    @DisplayName("Refuse to submit a software bundle without devices or a valid package")
    @Order(7)
    public void testSubmitRefused() {
        requireDevice();
        installBundleId = SoftwareBundleApi.createBundle().getId();

        List<GraphqlError> noDevices = SoftwareBundleApi.attemptSubmitBundleErrors(
                submitNow(installBundleId, INSTALL, List.of(wingetPackage(PACKAGE))));
        assertThat(codes(noDevices)).as("Submitting a bundle with no devices is a BAD_REQUEST").contains("BAD_REQUEST");
        assertThat(noDevices).extracting(GraphqlError::getMessage).as("The refusal says no devices are assigned")
                .anyMatch(m -> m.contains("no devices assigned"));

        assertThat(SoftwareBundleApi.addDevices(installBundleId, List.of(device.getId())).getDeviceCount())
                .as("The device is assigned for the package checks").isEqualTo(1);
        List<GraphqlError> noPackages = SoftwareBundleApi.attemptSubmitBundleErrors(submitNow(installBundleId, INSTALL, List.of()));
        assertThat(codes(noPackages)).as("An empty package list fails validation (1..50 packages)").contains("VALIDATION_ERROR");
        List<GraphqlError> untypedBrew = SoftwareBundleApi.attemptSubmitBundleErrors(
                submitNow(installBundleId, INSTALL, List.of(untypedBrewPackage("wget"))));
        assertThat(codes(untypedBrew)).as("A brew package without brewPackageType is a BAD_REQUEST").contains("BAD_REQUEST");
        assertThat(untypedBrew).extracting(GraphqlError::getMessage).as("The refusal names the missing brewPackageType")
                .anyMatch(m -> m.contains("brewPackageType"));

        String unknown = RelayIds.toGlobalId("SoftwareBundle", RUN_ID.toString());
        assertThat(codes(SoftwareBundleApi.attemptSubmitBundleErrors(submitNow(unknown, INSTALL, List.of(wingetPackage(PACKAGE))))))
                .as("Submitting an unknown bundle id is NOT_FOUND").contains("NOT_FOUND");

        SoftwareBundle after = SoftwareBundleApi.getBundle(installBundleId);
        assertThat(after.getStatus()).as("A refused submit leaves the bundle PENDING").isEqualTo("PENDING");
        assertThat(after.getAction()).as("A refused submit sets no action").isNull();
        assertThat(after.getPackages()).as("A refused submit stages no packages").isEmpty();
        assertThat(after.getCompletedAt()).as("A refused submit sets no completedAt").isNull();
        assertThat(after.getDeviceCount()).as("A refused submit keeps the assigned device").isEqualTo(1);
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Submit a software bundle to install a package now")
    @Order(8)
    public void testSubmitInstallNow() {
        requireInstallBundle();
        assumeTrue(device.getStatus() == DeviceStatus.ONLINE,
                HOSTNAME + " is " + device.getStatus() + "; an install submitted now would wait for it and land after this run");
        String winget = DeviceApi.getPackageManagerState(device.getMachineId(), "winget");
        assumeTrue(winget == null || "PRESENT".equals(winget),
                HOSTNAME + "'s agent reports winget=" + winget + "; submit refuses a package manager that is not yet usable (MISSING or UNKNOWN)");
        assumeTrue(MachineConfig.isConfigured() && HOSTNAME.equalsIgnoreCase(MachineConfig.getHostname()),
                "No SSH channel to " + HOSTNAME + " (TARGET_* / test.machine); it is needed to check the package is absent first and to uninstall it after");
        assumeTrue(!new SshMachineVerifier().windowsProgramInstalled(PROGRAM),
                PROGRAM + " is already installed on " + HOSTNAME + "; it is not this run's to reinstall or remove");

        SoftwareBundle result = SoftwareBundleApi.submitBundle(submitNow(installBundleId, INSTALL, List.of(wingetPackage(PACKAGE))));
        submitted = result;
        packageOnBox = true;

        assertThat(result.getId()).as("submit returns the submitted bundle").isEqualTo(installBundleId);
        assertThat(result.getStatus()).as("A submitted bundle is COMPLETED").isEqualTo("COMPLETED");
        assertThat(result.getMode()).as("No schedule means mode NOW").isEqualTo("NOW");
        assertThat(result.getAction()).as("submit records the action").isEqualTo(INSTALL);
        assertThat(result.getPackages()).extracting(SoftwareBundlePackage::getPackageManager, SoftwareBundlePackage::getPackageName)
                .as("submit records the packages").containsExactly(tuple(WINGET, PACKAGE));
        assertThat(result.getDeviceCount()).as("The assigned device is kept").isEqualTo(1);
        assertThat(result.getCompletedAt()).as("completedAt is the submit time").isNotBlank();
        assertThat(result.getStartAt()).as("startAt is null for NOW").isNull();
        assertThat(result.getScheduleId()).as("scheduleId is null for NOW").isNull();
        assertThat(result.getExecutionIds()).as("One execution id per dispatched package").hasSize(1);

        SoftwareBundle fetched = SoftwareBundleApi.getBundle(installBundleId);
        assertThat(fetched.getStatus()).as("The bundle is persisted as COMPLETED").isEqualTo("COMPLETED");
        assertThat(fetched.getCompletedAt()).as("completedAt is persisted").isEqualTo(result.getCompletedAt());
        assertThat(fetched.getExecutionIds()).as("executionIds are persisted").isEqualTo(result.getExecutionIds());
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Resubmit, reassign or delete a submitted software bundle")
    @Order(9)
    public void testSubmittedBundleIsFinal() {
        requireSubmitted();
        SoftwareBundle again = SoftwareBundleApi.submitBundle(submitNow(installBundleId, UPDATE, List.of(wingetPackage(PACKAGE))));
        assertThat(again.getStatus()).as("Resubmitting a COMPLETED bundle returns it as is").isEqualTo("COMPLETED");
        assertThat(again.getAction()).as("Resubmitting does not change the action").isEqualTo(INSTALL);
        assertThat(again.getCompletedAt()).as("Resubmitting does not change completedAt").isEqualTo(submitted.getCompletedAt());
        assertThat(again.getExecutionIds()).as("Resubmitting dispatches nothing new").isEqualTo(submitted.getExecutionIds());

        List<GraphqlError> reassign = SoftwareBundleApi.attemptAddDevicesErrors(installBundleId, List.of(device.getId()));
        assertThat(codes(reassign)).as("Assigning devices to a COMPLETED bundle is a BAD_REQUEST").contains("BAD_REQUEST");
        assertThat(reassign).extracting(GraphqlError::getMessage).as("The refusal says the bundle is COMPLETED")
                .anyMatch(m -> m.contains("COMPLETED"));

        assertThat(SoftwareBundleApi.deleteBundle(installBundleId)).as("Deleting a COMPLETED bundle returns false").isFalse();
        assertThat(SoftwareBundleApi.getBundle(installBundleId).getStatus())
                .as("A COMPLETED bundle survives the delete as history").isEqualTo("COMPLETED");
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("The submitted install finishes on the device")
    @Order(10)
    public void testInstallFinishes() {
        requireSubmitted();
        String rawBundleId = RelayIds.rawId(installBundleId);
        SoftwareActionRun run = FleetWait.until("the " + PACKAGE + " install of bundle " + rawBundleId + " to finish",
                () -> installRun(rawBundleId), r -> r != null && FINISHED.contains(r.getStatus()), INSTALL_TIMEOUT_SECONDS);

        assertThat(run.getExecutionId()).as("The action row is the bundle's execution").isEqualTo(submitted.getExecutionIds().getFirst());
        assertThat(run.getSoftware()).as("The row names the package").isEqualTo(PACKAGE);
        assertThat(run.getAction()).as("The row carries the action").isEqualTo(INSTALL);
        assertThat(run.getEngine()).as("The row carries the engine").isEqualTo(WINGET);
        assertThat(run.getScheduleId()).as("A NOW action has no schedule").isNull();
        assertThat(run.getTotalMachineCount()).as("One target device").isEqualTo(1);
        assertThat(run.getDispatchedAt()).as("A NOW action is dispatched at submit").isNotBlank();
        assertThat(run.getStatus()).as("The install finished successfully; device result: %s",
                SoftwareActionApi.getActionExecutions(run.getId(), null, null)).isEqualTo("COMPLETED");
        assertThat(run.getRespondedMachineCount()).as("The device responded").isEqualTo(1);
        assertThat(new SshMachineVerifier().windowsProgramInstalled(PROGRAM)).as(PROGRAM + " is installed on " + HOSTNAME).isTrue();
    }

    @Tag("feature")
    @Test
    @Disabled("No device with WINGET — the box runs Windows Server, where winget is unsupported")
    @DisplayName("Uninstall the package again over SSH")
    @Order(11)
    public void testUninstallPackage() {
        requireSubmitted();
        SshMachineVerifier ssh = new SshMachineVerifier();
        SshMachineVerifier.ExecResult uninstall = ssh.uninstallWindowsProgram(PACKAGE, PROGRAM);
        assertThat(uninstall.exitStatus()).as("The uninstall exits 0 once no entry matches; output: %s %s",
                uninstall.stdout(), uninstall.stderr()).isZero();
        assertThat(ssh.windowsProgramInstalled(PROGRAM)).as(PROGRAM + " is gone from " + HOSTNAME).isFalse();
        packageOnBox = false;
    }

    // Deletes a draft a failed run left behind (a submitted bundle cannot be deleted) and uninstalls the package if a failed run left it on the box.
    @AfterAll
    public static void cleanup() {
        if (bundleId != null) {
            SoftwareBundleApi.attemptDeleteBundle(bundleId);
        }
        if (installBundleId != null && submitted == null) {
            SoftwareBundleApi.attemptDeleteBundle(installBundleId);
        }
        if (packageOnBox) {
            SshMachineVerifier ssh = new SshMachineVerifier();
            if (ssh.windowsProgramInstalled(PROGRAM)) {
                ssh.uninstallWindowsProgram(PACKAGE, PROGRAM);
            }
        }
    }

    // The software action row of our bundle, or null until it is listed.
    private static SoftwareActionRun installRun(String rawBundleId) {
        SoftwareActionFilterInput wingetInstalls = SoftwareActionFilterInput.builder()
                .actions(List.of(INSTALL)).engines(List.of(WINGET)).build();
        return SoftwareActionApi.getActions(wingetInstalls, PACKAGE, PAGE, null).nodes().stream()
                .filter(r -> rawBundleId.equals(r.getBundleId()))
                .findFirst().orElse(null);
    }

    // Codes of the errors that carry one; graphql-java's code-less NullValueInNonNullableField is dropped.
    private static List<Object> codes(List<GraphqlError> errors) {
        return errors.stream()
                .map(error -> error.getExtensions() == null ? null : error.getExtensions().get("code"))
                .filter(Objects::nonNull)
                .toList();
    }

    private static void requireBundle() {
        assumeTrue(bundleId != null, "No bundle was created in \"Create an empty draft software bundle\"; see that failure");
    }

    private static void requireBundleAndDevice() {
        requireBundle();
        requireDevice();
    }

    private static void requireDevice() {
        assumeTrue(device != null && device.getId() != null,
                "Device " + HOSTNAME + " is not listed among the " + WINDOWS + " devices; the device cases need it");
    }

    private static void requireInstallBundle() {
        requireDevice();
        assumeTrue(installBundleId != null,
                "No bundle was created in \"Refuse to submit a software bundle without devices or a valid package\"; see that failure");
    }

    private static void requireSubmitted() {
        assumeTrue(submitted != null, "Nothing was installed in \"Submit a software bundle to install a package now\"; see why there");
    }
}
