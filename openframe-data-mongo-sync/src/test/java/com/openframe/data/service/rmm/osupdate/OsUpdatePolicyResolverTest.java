package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicy;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTarget;
import com.openframe.data.document.rmm.osupdate.OsUpdatePolicyTargetType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdatePolicyResolverTest {

    private static final Instant CREATED_AT = Instant.parse("2026-10-01T00:00:00Z");

    private OsUpdatePolicyResolver osUpdatePolicyResolver;
    private Machine machine;
    private OsUpdatePolicy tenantPolicy;
    private OsUpdatePolicy customerPolicy;
    private OsUpdatePolicy tagPolicy;
    private OsUpdatePolicy devicePolicy;

    @BeforeEach
    void setUp() {
        osUpdatePolicyResolver = new OsUpdatePolicyResolver();
        machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-1");
        tenantPolicy = policy("tenant", OsUpdatePolicyTarget.builder().type(OsUpdatePolicyTargetType.TENANT).build());
        customerPolicy = policy("customer", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build());
        tagPolicy = policy("tag", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-1", "tag-2")).build());
        devicePolicy = policy("device", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE).machineIds(List.of("machine-0", "machine-1")).build());
    }

    @Test
    void resolve_everyTargetTypeCoversTheDevice_policyOfTheDevice() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(tenantPolicy, customerPolicy, tagPolicy, devicePolicy), machine, Set.of("tag-2"));

        // verifications
        assertThat(resolved).isSameAs(devicePolicy);
    }

    @Test
    void resolve_noPolicyOfTheDevice_policyOfItsTag() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(tenantPolicy, customerPolicy, tagPolicy), machine, Set.of("tag-2"));

        // verifications
        assertThat(resolved).isSameAs(tagPolicy);
    }

    @Test
    void resolve_deviceWithoutTheTagsOfThePolicy_policyOfItsCustomer() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(tenantPolicy, customerPolicy, tagPolicy), machine, Set.of("tag-9"));

        // verifications
        assertThat(resolved).isSameAs(customerPolicy);
    }

    @Test
    void resolve_policiesOfAnotherCustomerAndOfOtherDevices_policyOfTheTenant() {
        // setup
        customerPolicy.getTarget().setOrganizationId("org-2");
        devicePolicy.getTarget().setMachineIds(List.of("machine-0"));

        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(devicePolicy, customerPolicy, tenantPolicy), machine, Set.of());

        // verifications
        assertThat(resolved).isSameAs(tenantPolicy);
    }

    @Test
    void resolve_twoTagPoliciesCoverTheDevice_theEarlierCreatedOne() {
        // setup
        OsUpdatePolicy laterTagPolicy = policy("later tag", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.DEVICE_TAG).tagIds(List.of("tag-3")).build());
        laterTagPolicy.setCreatedAt(CREATED_AT.plusSeconds(60));

        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(laterTagPolicy, tagPolicy), machine, Set.of("tag-1", "tag-3"));

        // verifications
        assertThat(resolved).isSameAs(tagPolicy);
    }

    @Test
    void resolve_noPolicyCoversTheDevice_empty() {
        // setup
        customerPolicy.getTarget().setOrganizationId("org-2");

        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolve(
                List.of(customerPolicy, tagPolicy), machine, Set.of());

        // verifications
        assertThat(resolved).isNull();
    }

    @Test
    void resolveOfCustomer_customerWithItsOwnPolicy_thatOneNotTheTenantsAndNeverATagOrDeviceOne() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolveOfCustomer(
                List.of(devicePolicy, tagPolicy, tenantPolicy, customerPolicy), "org-1");

        // verifications
        assertThat(resolved).isSameAs(customerPolicy);
    }

    @Test
    void resolveOfCustomer_customerWithoutItsOwnPolicy_theOneOfTheTenant() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolveOfCustomer(
                List.of(devicePolicy, tagPolicy, tenantPolicy, customerPolicy), "org-2");

        // verifications
        assertThat(resolved).isSameAs(tenantPolicy);
    }

    @Test
    void resolveOfCustomer_twoPoliciesOfTheCustomer_theEarlierCreatedOne() {
        // setup
        OsUpdatePolicy earlierCustomerPolicy = policy("earlier", OsUpdatePolicyTarget.builder()
                .type(OsUpdatePolicyTargetType.CUSTOMER).organizationId("org-1").build());
        earlierCustomerPolicy.setCreatedAt(CREATED_AT.minusSeconds(60));

        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolveOfCustomer(
                List.of(customerPolicy, earlierCustomerPolicy), "org-1");

        // verifications
        assertThat(resolved).isSameAs(earlierCustomerPolicy);
    }

    @Test
    void resolveOfCustomer_onlyTagAndDevicePolicies_null() {
        // execution
        OsUpdatePolicy resolved = osUpdatePolicyResolver.resolveOfCustomer(List.of(devicePolicy, tagPolicy), "org-1");

        // verifications
        assertThat(resolved).isNull();
    }

    private static OsUpdatePolicy policy(String name, OsUpdatePolicyTarget target) {
        return OsUpdatePolicy.builder().id(name).name(name).target(target).createdAt(CREATED_AT).build();
    }
}
