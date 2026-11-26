package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class OsUpdateOverrideResolverTest {

    private final OsUpdateOverrideResolver osUpdateOverrideResolver = new OsUpdateOverrideResolver();
    private Machine machine;
    private OsUpdateOverride ofDevice;
    private OsUpdateOverride ofCustomer;

    @BeforeEach
    void setUp() {
        machine = new Machine();
        machine.setMachineId("machine-1");
        machine.setOrganizationId("org-1");
        ofDevice = OsUpdateOverride.builder().id("device").machineId("machine-1").build();
        ofCustomer = OsUpdateOverride.builder().id("customer").organizationId("org-1").build();
    }

    @Test
    void resolve_overridesOfTheDeviceAndOfItsCustomer_theOneOfTheDevice() {
        // execution
        OsUpdateOverride resolved = osUpdateOverrideResolver.resolve(List.of(ofCustomer, ofDevice), machine);

        // verifications
        assertThat(resolved).isSameAs(ofDevice);
    }

    @Test
    void resolve_overrideOfAnotherDeviceOfTheCustomer_theOneOfTheCustomer() {
        // setup
        ofDevice.setMachineId("machine-2");

        // execution
        OsUpdateOverride resolved = osUpdateOverrideResolver.resolve(List.of(ofDevice, ofCustomer), machine);

        // verifications
        assertThat(resolved).isSameAs(ofCustomer);
    }

    @Test
    void resolve_overridesOfAnotherCustomerAndAnotherDevice_empty() {
        // setup
        ofDevice.setMachineId("machine-2");
        ofCustomer.setOrganizationId("org-2");

        // execution
        OsUpdateOverride resolved = osUpdateOverrideResolver.resolve(List.of(ofDevice, ofCustomer), machine);

        // verifications
        assertThat(resolved).isNull();
    }

    @Test
    void resolve_overridesOfItsCustomerAndOfEveryCustomer_theOneOfItsCustomer() {
        // setup
        OsUpdateOverride ofEveryCustomer = OsUpdateOverride.builder().id("every-customer").build();

        // execution
        OsUpdateOverride resolved =
                osUpdateOverrideResolver.resolve(List.of(ofEveryCustomer, ofCustomer), machine);

        // verifications
        assertThat(resolved).isSameAs(ofCustomer);
    }

    @Test
    void resolve_overrideOfEveryCustomerOnly_thatOne() {
        // setup
        OsUpdateOverride ofEveryCustomer = OsUpdateOverride.builder().id("every-customer").build();
        ofDevice.setMachineId("machine-2");
        ofCustomer.setOrganizationId("org-2");

        // execution
        OsUpdateOverride resolved =
                osUpdateOverrideResolver.resolve(List.of(ofDevice, ofCustomer, ofEveryCustomer), machine);

        // verifications
        assertThat(resolved).isSameAs(ofEveryCustomer);
    }
}
