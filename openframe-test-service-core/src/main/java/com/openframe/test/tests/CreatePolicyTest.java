package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.api.MonitoringApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import com.openframe.test.data.dto.policy.CreatePolicyRequest;
import com.openframe.test.data.dto.policy.Policy;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.getFleetId;
import static com.openframe.test.data.generator.DeviceGenerator.osAndStatusDevicesFilter;
import static com.openframe.test.data.generator.MonitoringGenerator.*;
import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Create Policy")
public class CreatePolicyTest extends BaseTest {

    @Tag("device")
    @Test
    @DisplayName("Add policy")
    public void testAddPolicy() {
        CreatePolicyRequest createPolicyRequest = emptyPolicy();
        Policy policy = MonitoringApi.createPolicy(createPolicyRequest);
        assertThat(policy.getId()).isNotNull();
        assertThat(policy.getName()).isEqualTo(createPolicyRequest.getName());
        assertThat(policy.getDescription()).isEqualTo(createPolicyRequest.getDescription());
        assertThat(policy.getQuery()).isEqualTo(createPolicyRequest.getQuery());
    }


    @Tag("device")
    @Test
    @DisplayName("Select policy device")
    public void testSelectPolicyDevice() {
        CreatePolicyRequest createPolicyRequest = windowsVersionPolicy();
        Policy policy = MonitoringApi.createPolicy(createPolicyRequest);
        assertThat(policy.getId()).isNotNull();
        assertThat(policy.getName()).isEqualTo(createPolicyRequest.getName());
        assertThat(policy.getDescription()).isEqualTo(createPolicyRequest.getDescription());
        assertThat(policy.getQuery()).isEqualTo(createPolicyRequest.getQuery());

        List<Machine> devices = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assertThat(devices).as("Expect Windows device online").isNotEmpty();
        Machine device = DeviceApi.getDevice(devices.getFirst().getMachineId());
        assertThat(device.getToolConnections()).as("Device should have agents").isNotEmpty();
        Integer fleetId = Integer.valueOf(getFleetId(device));
        assertThat(fleetId).as("Device should have Fleet").isNotNull();

        MonitoringApi.selectPolicyDevices(policy.getId(), fleetId);
        policy = MonitoringApi.getPolicy(policy.getId());
        assertThat(policy.getHostsIncludeAny()).contains(policyHost(device));
    }
}
