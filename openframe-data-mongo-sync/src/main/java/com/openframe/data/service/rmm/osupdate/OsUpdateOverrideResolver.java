package com.openframe.data.service.rmm.osupdate;

import com.openframe.data.document.device.Machine;
import com.openframe.data.document.rmm.osupdate.OsUpdateOverride;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.Optional;

@Component
public class OsUpdateOverrideResolver {

    // The override of one update that applies to the device: its own, else the one of its customer.
    public Optional<OsUpdateOverride> resolve(Collection<OsUpdateOverride> overridesOfOsUpdate, Machine machine) {
        Optional<OsUpdateOverride> ofDevice = overridesOfOsUpdate.stream()
                .filter(osUpdateOverride -> machine.getMachineId().equals(osUpdateOverride.getMachineId()))
                .findFirst();
        if (ofDevice.isPresent()) {
            return ofDevice;
        }
        return overridesOfOsUpdate.stream()
                .filter(osUpdateOverride -> osUpdateOverride.getMachineId() == null)
                .filter(osUpdateOverride ->
                        osUpdateOverride.getOrganizationId().equals(machine.getOrganizationId()))
                .findFirst();
    }
}
