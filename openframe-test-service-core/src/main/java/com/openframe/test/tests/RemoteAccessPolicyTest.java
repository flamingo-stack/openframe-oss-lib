package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.OrganizationApi;
import com.openframe.test.api.RemoteAccessPolicyApi;
import com.openframe.test.context.PipelineContext;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.organization.CreateOrganizationRequest;
import com.openframe.test.data.dto.organization.Organization;
import com.openframe.test.data.dto.remoteaccess.DeviceRemoteAccess;
import com.openframe.test.data.dto.remoteaccess.OrganizationRemoteAccessPolicy;
import com.openframe.test.data.dto.remoteaccess.OrganizationRemoteAccessPolicyPayload;
import com.openframe.test.data.dto.shared.GraphqlError;
import com.openframe.test.data.dto.shared.UserError;
import com.openframe.test.data.generator.DeviceGenerator;
import com.openframe.test.data.generator.OrganizationGenerator;
import com.openframe.test.helpers.ai.RunId;
import io.restassured.response.Response;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

/**
 * Pipeline-scoped remote-access mode.
 *
 * <p>A remote session's mode resolves device → organization → tenant → code default, and both
 * {@code APPROVAL_REQUIRED} (the code default) and {@code NOTIFY_ONLY} park the session until the end
 * user accepts on the device — {@code RemoteSessionService} gates on exactly those two. Nobody is at
 * the keyboard of the test box, so {@code DeviceRemoteTest} hung on that gate and failed with "the
 * remote-access approval gate is waiting for the end user" — the qa nightly of 2026-09-25 among them.
 *
 * <p>A pipeline run registers its own tenant, so it starts with no policy document at any scope and
 * lands on the code default. A long-lived tenant may sit anywhere; qa's {@code test-env} was at
 * {@code NOTIFY_ONLY} when this was written. Both gate, which is why the setup sets the mode outright
 * rather than checking whether it needs to.
 *
 * <p>Modelled on {@link AdminFixtureTest}: a setup phase the pipeline runs before the phase that needs
 * it, and a teardown phase at the very end, so the mode is changed once per run rather than per class
 * and the tenant is left as it was found. The previous mode travels between them in
 * {@link PipelineContext}.
 *
 * <p>Tenant scope, not device: that is the scope this suite owns. A device or organization override
 * still wins and would have to be cleared separately.
 */
@Tag("oss")
@Tag("remote-access-policy")
@DisplayName("Remote access policy")
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class RemoteAccessPolicyTest extends BaseTest {

    // The enrolled Windows box on qa; the device-scope cases override its policy and clear it again straight away.
    private static final String BOX_HOSTNAME = "vm115982";
    private static final List<String> SCOPES = List.of("ORGANIZATION", "TENANT", "DEFAULTS");
    private static final RunId RUN_ID = RunId.next();

    private static String tenantMode;
    private static Organization organization;
    private static boolean organizationArchived;
    private static boolean organizationOverrideMaySet;
    private static Machine box;
    private static DeviceRemoteAccess inherited;
    private static boolean deviceOverrideMaySet;

    @Tag("saas")
    @Tag("feature")
    @Test
    @DisplayName("A new organization inherits the tenant remote-access mode")
    @Order(1)
    public void testOrganizationInheritsTenantMode() {
        tenantMode = RemoteAccessPolicyApi.getTenantMode();
        CreateOrganizationRequest request = OrganizationGenerator.createOrganizationRequest(true);
        request.setName("E2E remote access " + RUN_ID);
        organization = OrganizationApi.createOrganization(request);
        String organizationId = organization.getOrganizationId();
        assertThat(organizationId).as("The throwaway organization has an organizationId").isNotBlank();

        OrganizationRemoteAccessPolicy policy = RemoteAccessPolicyApi.getOrganizationPolicy(organizationId);

        assertThat(policy.getOrganizationId()).as("The policy belongs to the organization").isEqualTo(organizationId);
        assertThat(policy.getMode()).as("A new organization has no override").isNull();
        assertThat(policy.getEffectiveMode()).as("It inherits the tenant mode").isEqualTo(tenantMode);
        assertThat(policy.getUpdatedBy()).as("Nobody has set an override").isNull();
        assertThat(policy.getUpdatedAt()).as("No override has a timestamp").isNull();
    }

    @Tag("saas")
    @Tag("feature")
    @Test
    @DisplayName("An organization override replaces the inherited mode")
    @Order(2)
    public void testOverrideOrganizationMode() {
        requireOrganization();
        String organizationId = organization.getOrganizationId();
        // A mode other than the tenant's, so the effective mode visibly follows the override.
        String organizationOverride = RemoteAccessPolicyApi.APPROVAL_REQUIRED.equals(tenantMode)
                ? RemoteAccessPolicyApi.NOTIFY_ONLY : RemoteAccessPolicyApi.APPROVAL_REQUIRED;
        organizationOverrideMaySet = true;

        OrganizationRemoteAccessPolicyPayload payload = RemoteAccessPolicyApi.setOrganizationMode(organizationId, organizationOverride);

        assertThat(payload.getUserErrors()).as("Setting the override reports no userErrors").isEmpty();
        OrganizationRemoteAccessPolicy policy = payload.getPolicy();
        assertThat(policy.getOrganizationId()).as("The payload names the organization").isEqualTo(organizationId);
        assertThat(policy.getMode()).as("The override is stored").isEqualTo(organizationOverride);
        assertThat(policy.getEffectiveMode()).as("The override is what applies").isEqualTo(organizationOverride);
        assertThat(policy.getUpdatedBy()).as("The override records who set it").isNotBlank();
        assertThat(policy.getUpdatedAt()).as("The override records when it was set").isNotBlank();

        OrganizationRemoteAccessPolicy fetched = RemoteAccessPolicyApi.getOrganizationPolicy(organizationId);
        assertThat(fetched.getMode()).as("The query returns the override").isEqualTo(organizationOverride);
        assertThat(fetched.getEffectiveMode()).as("The query resolves to the override").isEqualTo(organizationOverride);
        assertThat(RemoteAccessPolicyApi.getTenantMode()).as("The tenant mode is untouched").isEqualTo(tenantMode);
    }

    @Tag("saas")
    @Tag("feature")
    @Test
    @DisplayName("Clearing the organization override restores the inherited mode")
    @Order(3)
    public void testClearOrganizationOverride() {
        requireOrganizationOverride();
        String organizationId = organization.getOrganizationId();

        OrganizationRemoteAccessPolicyPayload payload = RemoteAccessPolicyApi.setOrganizationMode(organizationId, null);
        assertThat(payload.getUserErrors()).as("Clearing the override reports no userErrors").isEmpty();
        organizationOverrideMaySet = false;

        OrganizationRemoteAccessPolicy policy = payload.getPolicy();
        assertThat(policy.getMode()).as("The override is gone").isNull();
        assertThat(policy.getEffectiveMode()).as("The tenant mode applies again").isEqualTo(tenantMode);
        assertThat(policy.getUpdatedBy()).as("An inheriting policy has no author").isNull();

        OrganizationRemoteAccessPolicy fetched = RemoteAccessPolicyApi.getOrganizationPolicy(organizationId);
        assertThat(fetched.getMode()).as("The query shows no override").isNull();
        assertThat(fetched.getEffectiveMode()).as("The query resolves to the tenant mode").isEqualTo(tenantMode);
    }

    @Tag("saas")
    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("An unknown organization is refused with ORGANIZATION_NOT_FOUND")
    @Order(4)
    public void testUnknownOrganizationIsRefused() {
        String unknown = UUID.randomUUID().toString();

        OrganizationRemoteAccessPolicyPayload payload = RemoteAccessPolicyApi.setOrganizationMode(unknown, RemoteAccessPolicyApi.APPROVAL_REQUIRED);

        assertThat(payload.getUserErrors()).as("The mutation refuses in userErrors")
                .extracting(UserError::getCode).containsExactly("ORGANIZATION_NOT_FOUND");
        assertThat(payload.getPolicy()).as("A refusal carries no policy").isNull();

        Response query = RemoteAccessPolicyApi.getOrganizationPolicyRaw(unknown);
        List<GraphqlError> errors = query.jsonPath().getList("errors", GraphqlError.class);
        assertThat(query.getStatusCode()).as("The query refusal is a GraphQL error on a 200").isEqualTo(200);
        // graphql-java adds a NullValueInNonNullableField error next to the refusal, because the field is non-null.
        assertThat(errors).as("The query refuses with ORGANIZATION_NOT_FOUND")
                .extracting(e -> e.getExtensions().get("code")).contains("ORGANIZATION_NOT_FOUND");
        assertThat(query.jsonPath().getString("data")).as("A refused query returns no data").isNull();
    }

    @Tag("saas")
    @Tag("feature")
    @Test
    @DisplayName("Archive the throwaway organization")
    @Order(5)
    public void testArchiveOrganization() {
        requireOrganization();

        OrganizationApi.archiveOrganization(organization);
        organizationArchived = true;
    }

    @Tag("saas")
    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("A device with no override resolves through its organization and the tenant")
    @Order(6)
    public void testDeviceInheritsPolicy() {
        box = DeviceApi.getDevices(DeviceGenerator.osDevicesFilter("WINDOWS")).stream()
                .filter(m -> BOX_HOSTNAME.equalsIgnoreCase(m.getHostname()))
                .min(Comparator.comparing(m -> m.getStatus() != DeviceStatus.ONLINE))
                .orElse(null);
        assumeTrue(box != null, BOX_HOSTNAME + " is not enrolled in this tenant");

        inherited = RemoteAccessPolicyApi.getDeviceRemoteAccess(box.getMachineId());
        log.info("{} remote access before the device cases: {}", BOX_HOSTNAME, inherited);
        assumeTrue(inherited.getMode() == null,
                BOX_HOSTNAME + " already carries a device override (" + inherited.getMode() + "); it is not this suite's to change");

        OrganizationRemoteAccessPolicy organizationPolicy = RemoteAccessPolicyApi.getOrganizationPolicy(box.getOrganizationId());
        assertThat(inherited.getEffectiveScope()).as("Without a device override the mode comes from further up").isIn(SCOPES);
        assertThat(inherited.getEffectiveMode()).as("The device resolves to its organization's effective mode")
                .isEqualTo(organizationPolicy.getEffectiveMode());
        assertThat(inherited.getEffectiveScope().equals("ORGANIZATION"))
                .as("The scope is ORGANIZATION exactly when the organization carries an override")
                .isEqualTo(organizationPolicy.getMode() != null);
        assertThat(inherited.getUpdatedBy()).as("Nobody has set a device override").isNull();
    }

    @Tag("saas")
    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("A device override takes the DEVICE scope")
    @Order(7)
    public void testOverrideDeviceMode() {
        requireInheritingBox();
        // The mode the box already resolves to, so remote sessions to it behave the same while the override exists.
        String mode = inherited.getEffectiveMode();
        deviceOverrideMaySet = true;

        Machine updated = RemoteAccessPolicyApi.setDeviceMode(box.getMachineId(), mode);

        assertThat(updated.getMachineId()).as("The mutation returns the device").isEqualTo(box.getMachineId());
        DeviceRemoteAccess remoteAccess = updated.getRemoteAccess();
        assertThat(remoteAccess.getMode()).as("The override is stored").isEqualTo(mode);
        assertThat(remoteAccess.getEffectiveMode()).as("The override is what applies").isEqualTo(mode);
        assertThat(remoteAccess.getEffectiveScope()).as("The device scope wins").isEqualTo("DEVICE");
        assertThat(remoteAccess.getUpdatedBy()).as("The override records who set it").isNotBlank();
        assertThat(remoteAccess.getUpdatedAt()).as("The override records when it was set").isNotBlank();

        DeviceRemoteAccess fetched = RemoteAccessPolicyApi.getDeviceRemoteAccess(box.getMachineId());
        assertThat(fetched.getMode()).as("Machine.remoteAccess shows the override").isEqualTo(mode);
        assertThat(fetched.getEffectiveScope()).as("Machine.remoteAccess resolves at DEVICE scope").isEqualTo("DEVICE");
    }

    @Tag("saas")
    @Tag("feature")
    @Tag("needs-device")
    @Test
    @DisplayName("Clearing the device override restores the inherited scope")
    @Order(8)
    public void testClearDeviceOverride() {
        requireDeviceOverride();

        Machine updated = RemoteAccessPolicyApi.setDeviceMode(box.getMachineId(), null);
        deviceOverrideMaySet = false;

        DeviceRemoteAccess remoteAccess = updated.getRemoteAccess();
        assertThat(remoteAccess.getMode()).as("The override is gone").isNull();
        assertThat(remoteAccess.getEffectiveScope()).as("The previous scope applies again").isEqualTo(inherited.getEffectiveScope());
        assertThat(remoteAccess.getEffectiveMode()).as("The previous mode applies again").isEqualTo(inherited.getEffectiveMode());

        DeviceRemoteAccess fetched = RemoteAccessPolicyApi.getDeviceRemoteAccess(box.getMachineId());
        assertThat(fetched.getMode()).as("Machine.remoteAccess shows no override").isNull();
        assertThat(fetched.getEffectiveScope()).as("Machine.remoteAccess resolves as before").isEqualTo(inherited.getEffectiveScope());
    }

    @Tag("saas")
    @Tag("feature")
    @Tag("negative")
    @Test
    @DisplayName("An unknown device is refused with DEVICE_NOT_FOUND")
    @Order(9)
    public void testUnknownDeviceIsRefused() {
        Response response = RemoteAccessPolicyApi.setDeviceModeRaw(UUID.randomUUID().toString(), RemoteAccessPolicyApi.APPROVAL_REQUIRED);
        List<GraphqlError> errors = response.jsonPath().getList("errors", GraphqlError.class);

        assertThat(response.getStatusCode()).as("The refusal is a GraphQL error on a 200").isEqualTo(200);
        // graphql-java adds a NullValueInNonNullableField error next to the refusal, because Machine! is non-null.
        assertThat(errors).as("The mutation refuses with DEVICE_NOT_FOUND in extensions.code")
                .extracting(e -> e.getExtensions().get("code")).contains("DEVICE_NOT_FOUND");
        assertThat(response.jsonPath().getString("data")).as("A refused mutation returns no device").isNull();
    }

    @Tag("remote-access-setup")
    @Test
    @DisplayName("Allow remote sessions to open without an approval step")
    public void allowSilentRemoteAccess() {
        String previous = RemoteAccessPolicyApi.setTenantMode(RemoteAccessPolicyApi.SILENT_ACCESS);
        PipelineContext.setPreviousRemoteAccessMode(previous);

        assertThat(RemoteAccessPolicyApi.getTenantMode())
                .as("The tenant should now open remote sessions silently")
                .isEqualTo(RemoteAccessPolicyApi.SILENT_ACCESS);
    }

    @Tag("remote-access-teardown")
    @Test
    @DisplayName("Restore the tenant remote-access mode")
    public void restoreRemoteAccessMode() {
        String previous = PipelineContext.getPreviousRemoteAccessMode();
        if (previous == null || RemoteAccessPolicyApi.SILENT_ACCESS.equals(previous)) {
            log.info("Nothing to restore: the tenant was already at {}", previous);
            return;
        }
        RemoteAccessPolicyApi.setTenantMode(previous);

        assertThat(RemoteAccessPolicyApi.getTenantMode())
                .as("The tenant should be left as the run found it")
                .isEqualTo(previous);
    }

    // Clears whatever override a failed case left set and archives the organization if its case never ran; raw calls never throw.
    @AfterAll
    public static void cleanup() {
        if (deviceOverrideMaySet) {
            log.info("Clearing the device override left on {}: HTTP {}", BOX_HOSTNAME,
                    RemoteAccessPolicyApi.setDeviceModeRaw(box.getMachineId(), null).getStatusCode());
        }
        if (organization != null && organizationOverrideMaySet) {
            RemoteAccessPolicyApi.setOrganizationModeRaw(organization.getOrganizationId(), null);
        }
        if (organization != null && !organizationArchived) {
            OrganizationApi.archiveOrganizationRaw(organization.getOrganizationId());
        }
    }

    private static void requireOrganization() {
        assumeTrue(organization != null && !organizationArchived,
                "No organization was created in \"A new organization inherits the tenant remote-access mode\"; see that failure");
    }

    private static void requireOrganizationOverride() {
        requireOrganization();
        assumeTrue(organizationOverrideMaySet,
                "No override was set in \"An organization override replaces the inherited mode\"; see that failure");
    }

    private static void requireInheritingBox() {
        assumeTrue(box != null && inherited != null && inherited.getMode() == null,
                "No inheriting device was found in \"A device with no override resolves through its organization and the tenant\"; see that case");
    }

    private static void requireDeviceOverride() {
        requireInheritingBox();
        assumeTrue(deviceOverrideMaySet,
                "No device override was set in \"A device override takes the DEVICE scope\"; see that failure");
    }
}
