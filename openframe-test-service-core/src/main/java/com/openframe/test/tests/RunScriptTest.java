package com.openframe.test.tests;

import com.openframe.test.api.DeviceApi;
import com.openframe.test.data.dto.device.DeviceStatus;
import com.openframe.test.data.dto.device.Machine;
import org.junit.jupiter.api.Test;

import java.util.List;

import static com.openframe.test.data.generator.DeviceGenerator.getTacticalId;
import static com.openframe.test.data.generator.DeviceGenerator.osAndStatusDevicesFilter;
import static org.assertj.core.api.Assertions.assertThat;

public class RunScriptTest extends BaseTest {

    @Test
    public void testBulkRun() {
        List<Machine> devices = DeviceApi.getDevices(osAndStatusDevicesFilter("WINDOWS", DeviceStatus.ONLINE));
        assertThat(devices).as("Expect Windows device online").isNotEmpty();
        Machine device = DeviceApi.getDevice(devices.getFirst().getMachineId());
        assertThat(device.getToolConnections()).isNotEmpty();
        String tacticalId = getTacticalId(device);
        assertThat(tacticalId).isNotEmpty();
    }
}
